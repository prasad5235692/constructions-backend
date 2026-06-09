const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { isMasterAdmin } = require('../utils/auth');

const router = express.Router();
const baseUploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const uploadDirectory = path.join(baseUploadDir, 'documents');

try {
  if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
  }
} catch (_) {
  console.warn('Upload directory not available (running on serverless?)');
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.pdf';
    const baseName = path.basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'document';

    callback(null, `${Date.now()}-${baseName}${extension.toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('Only PDF files are allowed'));
      return;
    }

    callback(null, true);
  },
}).single('file');

function toRelativeFilePath(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
}

function buildPublicUri(req, filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/${normalizedPath}`;
}

function mapDocument(req, document) {
  const source = typeof document.toObject === 'function' ? document.toObject() : document;

  return {
    id: source._id?.toString?.() || source.id,
    module: source.module,
    referenceId: source.referenceId,
    documentType: source.documentType,
    name: source.name,
    storedName: source.storedName,
    uri: source.uri || buildPublicUri(req, source.filePath),
    mimeType: source.mimeType,
    size: source.size,
    notes: source.notes,
    uploadedAt: source.uploadedAt,
    uploadedBy: source.uploadedBy,
  };
}

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};

    if (req.query.module) {
      filter.module = req.query.module;
    }

    if (req.query.referenceId) {
      filter.referenceId = req.query.referenceId;
    }

    if (req.query.documentType) {
      filter.documentType = req.query.documentType;
    }

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'name role')
      .sort({ uploadedAt: -1, createdAt: -1 });

    res.json({ documents: documents.map((document) => mapDocument(req, document)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/documents/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('uploadedBy', 'name role');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ document: mapDocument(req, document) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/documents
router.post('/', auth, (req, res) => {
  upload(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'PDF file is required' });
      }

      const filePath = toRelativeFilePath(req.file.path);
      const uri = buildPublicUri(req, filePath);
      const referenceId = String(req.body.referenceId || req.body.documentType || 'general').trim();
      const documentType = String(req.body.documentType || referenceId || 'General').trim();
      const moduleName = String(req.body.module || 'pdfUpload').trim();

      const document = await Document.create({
        module: moduleName,
        referenceId,
        documentType,
        name: req.file.originalname,
        storedName: req.file.filename,
        filePath,
        uri,
        mimeType: req.file.mimetype,
        size: req.file.size,
        notes: req.body.notes || '',
        uploadedBy: req.user._id,
      });

      await createAuditLog({
        module: 'documents',
        action: 'create-document',
        entityType: 'Document',
        entityId: document._id,
        user: req.user,
        description: `Uploaded document ${document.name}`,
        metadata: { referenceId, documentType, module: moduleName },
      });

      res.status(201).json({ document: mapDocument(req, document) });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ message: error.message });
    }
  });
});

// PUT /api/documents/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && !isMasterAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to update this document' });
    }

    if (req.body.module !== undefined) {
      document.module = String(req.body.module || document.module).trim();
    }

    if (req.body.referenceId !== undefined) {
      document.referenceId = String(req.body.referenceId || document.referenceId).trim();
    }

    if (req.body.documentType !== undefined) {
      document.documentType = String(req.body.documentType || document.documentType).trim();
    }

    if (req.body.notes !== undefined) {
      document.notes = String(req.body.notes || '').trim();
    }

    await document.save();

    await createAuditLog({
      module: 'documents',
      action: 'update-document',
      entityType: 'Document',
      entityId: document._id,
      user: req.user,
      description: `Updated document ${document.name}`,
      metadata: {
        module: document.module,
        referenceId: document.referenceId,
        documentType: document.documentType,
      },
    });

    res.json({ document: mapDocument(req, document) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && !isMasterAdmin(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    const absoluteFilePath = path.join(__dirname, '..', document.filePath);
    if (fs.existsSync(absoluteFilePath)) {
      fs.unlinkSync(absoluteFilePath);
    }

    await document.deleteOne();

    await createAuditLog({
      module: 'documents',
      action: 'delete-document',
      entityType: 'Document',
      entityId: document._id,
      user: req.user,
      description: `Deleted document ${document.name}`,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;