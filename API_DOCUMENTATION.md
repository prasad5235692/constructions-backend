# Star Constructions Server API

## Overview

- Base URL: `/api`
- Authentication: JWT bearer token
- Roles: `masterAdmin`, `admin`
- Response format: JSON for all API endpoints
- File uploads: multipart form data for `/api/documents`

## Environment

Required environment variables:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/starconstructions
JWT_SECRET=replace-with-secure-secret
JWT_EXPIRE=30d
SEED_MASTER_ADMIN_NAME=Master Admin
SEED_MASTER_ADMIN_EMAIL=admin@example.com
SEED_MASTER_ADMIN_PASSWORD=replace-with-secure-password
SEED_MASTER_ADMIN_PHONE=+91XXXXXXXXXX
```

Notes:

- `SEED_MASTER_ADMIN_*` values are optional.
- When those seed variables are present, `npm run seed` creates the first `masterAdmin` user if it does not already exist.
- `npm run seed` also inserts the master material catalog used by the material module.

## Authentication

All protected endpoints require:

```http
Authorization: Bearer <jwt-token>
```

### POST `/auth/login`

Request body:

```json
{
  "email": "admin@example.com",
  "password": "secure-password"
}
```

Response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "...",
    "name": "Master Admin",
    "email": "admin@example.com",
    "phone": "+91XXXXXXXXXX",
    "role": "masterAdmin",
    "assignedBuildingId": null,
    "employeeId": null,
    "isActive": true,
    "lastLoginAt": "2026-06-06T10:00:00.000Z"
  }
}
```

### POST `/auth/logout`

- Protected
- Records an audit log entry
- Client should still clear the local JWT token

### GET `/auth/me`

- Protected
- Returns the authenticated user profile

### PUT `/auth/profile`

- Protected
- Allows updating `name` and `phone`

Request body:

```json
{
  "name": "Updated Name",
  "phone": "+91XXXXXXXXXX"
}
```

### PUT `/auth/change-password`

- Protected
- New password must be at least 8 characters

Request body:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-secure-password"
}
```

### POST `/auth/create-admin`

- Protected
- `masterAdmin` only
- Alias of `POST /auth/users`
- Can only create `admin` users

### POST `/auth/users`

- Protected
- `masterAdmin` only

Request body:

```json
{
  "name": "Admin User",
  "email": "ops@example.com",
  "password": "secure-password",
  "phone": "+91XXXXXXXXXX",
  "role": "admin"
}
```

### GET `/auth/users`

- Protected
- `masterAdmin` only
- Returns all users excluding password hashes

### PUT `/auth/users/:id`

- Protected
- `masterAdmin` only
- Can update `name`, `email`, `phone`, `role`, `isActive`, `password`
- Cannot downgrade or delete another `masterAdmin` through this endpoint

### DELETE `/auth/users/:id`

- Protected
- `masterAdmin` only
- Cannot delete own account
- Cannot delete another `masterAdmin`

## Dashboard

### GET `/dashboard`

- Protected
- Returns top-level ERP summary metrics

Response fields:

- `totalLands`
- `bookedLands`
- `availableLands`
- `totalBuildings`
- `ongoingBuildings`
- `completedBuildings`
- `totalEmployees`
- `totalVendors`
- `totalMaterialCost`
- `totalProjectCost`
- `monthlyRevenue`
- `monthlyExpenses`
- `landStats`
- `buildingProgress`
- `employeeAttendance`
- `expenseVsIncome`

## Lands

### GET `/lands`

Query parameters:

- `category=booking|booked`
- `status=Pending|In Progress|Completed`

### GET `/lands/:id`

- Returns a single land record

### POST `/lands`

- Protected
- Requires `landName`
- Supports the full land management structure:
  - `partyDetails`
  - `document`
  - `previousDocument`
  - `legalOpinion`
  - `registration`
  - `brokerCommission`
  - `approvalProcess`
  - `cleaning`
  - `survey`
  - `fieldWork`
  - `roadWork`
  - `ebWork`
  - `compound`
  - `plotStone`
  - `advertisement`
  - `sales`
  - `expenses`
  - `status`
  - `financialStatus`

### PUT `/lands/:id`

- Protected
- Updates the supported land fields

### DELETE `/lands/:id`

- Protected

### POST `/lands/:id/sales`

- Protected
- Adds a sales entry for a land

### PUT `/lands/:id/sales/:saleId`

- Protected
- Updates an existing land sales entry

### DELETE `/lands/:id/sales/:saleId`

- Protected

### POST `/lands/:id/expenses`

- Protected
- Adds a land expense line

### DELETE `/lands/:id/expenses/:expenseId`

- Protected

### POST `/lands/:id/remarks`

- Protected
- Stores a land-specific remark with author and timestamp

## Buildings

### GET `/buildings`

Query parameters:

- `category=upcoming|ongoing|completed`

### GET `/buildings/:id`

- Returns a single building with populated employees and vendors

### POST `/buildings`

- Protected
- Requires `buildingName`

Core request fields:

```json
{
  "buildingName": "Building A",
  "clientName": "Client Name",
  "siteAddress": "Address",
  "landId": "mongo-id",
  "floors": 2,
  "buildingArea": "2500 sqft",
  "category": "ongoing",
  "agreementDetails": "Agreement text",
  "constructionProgress": 35
}
```

The building schema also supports the detailed construction module sections:

- `party`
- `approval.vst`
- `approval.udg`
- `approval.plan`
- `plotter`
- `structural`
- `pooja`
- `bore`
- `storeRoom`
- `ebConstruction`
- `sand`
- `aggregate`
- `bricks`
- `cement`
- `steel`
- `equipment`
- `masonWork`
- `fitter`
- `electricianWorks`
- `plumberWorks`
- `painter`
- `carpenter`
- `tiles`
- `welder`
- `freight`
- `udgConnectionWork`
- `gift`
- `sathakka`

### PUT `/buildings/:id`

- Protected
- Updates general building fields and the nested construction sections above

### DELETE `/buildings/:id`

- Protected

### POST `/buildings/:id/daily-updates`

- Protected

Request body:

```json
{
  "date": "2026-06-06T10:00:00.000Z",
  "note": "Roof slab curing started"
}
```

### POST `/buildings/:id/remarks`

- Protected

### PUT `/buildings/:id/approvals/:approvalKey`

- Protected
- Used for approval register updates

Request body:

```json
{
  "status": "Approved",
  "date": "2026-06-06T10:00:00.000Z",
  "amount": 15000,
  "remarks": "Approved by local body"
}
```

## Employees

### GET `/employees`

Query parameters:

- `buildingId=<mongo-id>`
- `category=Mason|Carpenter|Electrician|Plumber|Painter|Welder|Contractor|Labour|Helper|Temporary Worker`

### GET `/employees/:id`

- Returns the employee with populated assigned building

### POST `/employees`

- Protected
- Requires `employeeName`
- Automatically links the employee to the assigned building when `assignedBuildingId` is provided

### PUT `/employees/:id`

- Protected
- Updates profile, assignment, salary, leave, and attendance summary fields

### DELETE `/employees/:id`

- Protected
- Removes the employee from linked buildings

### PUT `/employees/:id/assign-building`

- Protected

Request body:

```json
{
  "buildingId": "mongo-id"
}
```

### PUT `/employees/:id/remove-building`

- Protected

### PUT `/employees/:id/transfer`

- Protected

Request body:

```json
{
  "toBuildingId": "mongo-id"
}
```

### POST `/employees/:id/attendance`

- Protected
- Attendance statuses: `Present`, `Absent`, `Half Day`

Request body:

```json
{
  "date": "2026-06-06T10:00:00.000Z",
  "status": "Present",
  "buildingId": "mongo-id"
}
```

### GET `/employees/:id/attendance`

Query parameters:

- `month=6`
- `year=2026`

### POST `/employees/:id/payments`

- Protected
- Adds employee wage or salary payment history

## Materials

### GET `/materials`

Query parameters:

- `category=Sand|Bricks|Cement|Steel|Electrical|Plumbing|Other`

### GET `/materials/:id`

### POST `/materials`

- Protected
- Requires `materialName`
- Creates a master material record

### PUT `/materials/:id`

- Protected

### DELETE `/materials/:id`

- Protected
- Also removes linked ledger rows

### GET `/materials/ledger/:buildingId`

- Protected
- Returns building material ledger entries

### POST `/materials/ledger/:buildingId`

- Protected
- Adds quantity to a building-specific material ledger and updates building material summary

Request body:

```json
{
  "materialId": "mongo-id",
  "quantity": 100,
  "rate": 420,
  "note": "Initial cement stock"
}
```

### PUT `/materials/ledger/:buildingId/:materialId/use`

- Protected
- Deducts material from the building ledger and updates the building material summary

Request body:

```json
{
  "quantity": 20,
  "note": "Used for slab work"
}
```

## Vendors

### GET `/vendors`

Query parameters:

- `vendorType=Material Supplier|Contractor|Electrician|Plumber|Painter|Welder|Transport`

### GET `/vendors/:id`

### POST `/vendors`

- Protected
- Requires `vendorName`

### PUT `/vendors/:id`

- Protected

### DELETE `/vendors/:id`

- Protected

### POST `/vendors/:id/payments`

- Protected
- Adds vendor payment history and reduces pending dues

Request body:

```json
{
  "date": "2026-06-06T10:00:00.000Z",
  "amount": 25000,
  "note": "Steel delivery settlement"
}
```

## Payments

### GET `/payments`

Query parameters:

- `buildingId=<mongo-id>`
- `category=Salary|Labour|Vendor|Material|Expense|Land Expense|Other`
- `status=Pending|Paid|Partial|Cancelled`

### GET `/payments/:id`

### POST `/payments`

- Protected
- Requires `title`
- Requires `amount > 0`

Request body:

```json
{
  "title": "June Mason Wage",
  "category": "Labour",
  "buildingId": "mongo-id",
  "employeeId": "mongo-id",
  "amount": 18000,
  "dueDate": "2026-06-30",
  "status": "Pending",
  "remarks": "Ground floor wall work",
  "frequency": "Monthly",
  "paidTo": "Ravi"
}
```

### PUT `/payments/:id`

- Protected
- Automatically sets `paidDate` if status changes to `Paid` and no paid date is supplied

### DELETE `/payments/:id`

- Protected

## Leave Requests

### GET `/leave-requests`

Query parameters:

- `employeeId=<mongo-id>`
- `status=Pending|Approved|Rejected`

### POST `/leave-requests`

- Protected
- Requires `employeeId`, `fromDate`, `toDate`, `days`

### PUT `/leave-requests/:id`

- Protected
- Updates the approval status

Request body:

```json
{
  "status": "Approved"
}
```

## Remarks

### GET `/remarks`

Query parameters:

- `module=lands|buildings|employees|payments|materials|vendors|reports|attendance|leave|pdfUpload`
- `referenceId=<mongo-id-or-string>`

### POST `/remarks`

- Protected

Request body:

```json
{
  "module": "buildings",
  "referenceId": "mongo-id",
  "text": "Need extra shuttering material tomorrow"
}
```

### DELETE `/remarks/:id`

- Protected
- Allowed for the remark author or a `masterAdmin`

## Documents

### GET `/documents`

Query parameters:

- `module=pdfUpload`
- `referenceId=Land Layout`
- `documentType=Agreement`

### GET `/documents/:id`

### POST `/documents`

- Protected
- Multipart form upload
- Only PDF files are accepted
- Maximum file size: 10 MB

Form fields:

- `file`: PDF file
- `module`: logical module key such as `pdfUpload`
- `referenceId`: string identifier such as `Land Layout`, building id, land id, or another business reference
- `documentType`: display type such as `Agreement`, `Estimate`, `Approval`
- `notes`: optional text

Response includes:

- `id`
- `module`
- `referenceId`
- `documentType`
- `name`
- `storedName`
- `uri`
- `mimeType`
- `size`
- `notes`
- `uploadedAt`

### PUT `/documents/:id`

- Protected
- Allowed for uploader or `masterAdmin`
- Updates `module`, `referenceId`, `documentType`, `notes`

### DELETE `/documents/:id`

- Protected
- Allowed for uploader or `masterAdmin`
- Removes both MongoDB metadata and the stored PDF file

## Uploaded File Access

Uploaded documents are served from:

```text
/uploads/documents/<stored-file-name>.pdf
```

The API already returns the public `uri` for each uploaded file, so the mobile app can open the document directly.

## Audit Logs

The backend records audit log entries for:

- authentication events
- user administration
- land CRUD and land sub-record changes
- building CRUD, daily updates, remarks, and approvals
- employee CRUD, assignment, transfer, attendance, and payments
- material CRUD and ledger changes
- vendor CRUD and payments
- payment CRUD
- leave request create and status update
- remarks create and delete
- document create, update, and delete

Audit records are stored in the `AuditLog` collection.

## Health Check

### GET `/health`

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-06-06T10:00:00.000Z"
}
```