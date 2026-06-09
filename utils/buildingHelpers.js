const Building = require('../models/Building');

async function updateBuildingStatusToProcessing(buildingId) {
  if (!buildingId) return false;

  try {
    const result = await Building.findByIdAndUpdate(
      buildingId,
      { status: 'Processing' },
      { new: true }
    ).where('status').equals('New');
    if (!result) return false;
    return true;
  } catch (error) {
    console.error(`[updateBuildingStatusToProcessing] Error for building ${buildingId}: ${error.message}`);
    return false;
  }
}

async function autoProcessBuildingIfHasActivity(buildingId) {
  if (!buildingId) return false;

  try {
    const building = await Building.findById(buildingId);
    if (!building || building.status !== 'New') return false;

    const BuildingMaterial = require('../models/BuildingMaterial');
    const Payment = require('../models/Payment');
    const Work = require('../models/Work');
    const Attendance = require('../models/Attendance');
    const Employee = require('../models/Employee');
    const SalaryEntry = require('../models/SalaryEntry');
    const Approval = require('../models/Approval');
    const ClientPayment = require('../models/ClientPayment');
    const CompanyExpense = require('../models/CompanyExpense');
    const RestockRequest = require('../models/RestockRequest');
    const Remark = require('../models/Remark');

    const [
      materialCount,
      paymentCount,
      workCount,
      attendanceCount,
      employeeCount,
      salaryEntryCount,
      approvalCount,
      clientPaymentCount,
      companyExpenseCount,
      restockCount,
      remarkCount,
    ] = await Promise.all([
      BuildingMaterial.countDocuments({ buildingId }),
      Payment.countDocuments({ buildingId, status: { $ne: 'Cancelled' } }),
      Work.countDocuments({ buildingId }),
      Attendance.countDocuments({ buildingId }),
      Employee.countDocuments({ assignedBuildingId: buildingId }),
      SalaryEntry.countDocuments({ buildingId }),
      Approval.countDocuments({
        buildingId,
        $or: [
          { status: 'Approved' },
          { amount: { $gt: 0 } },
          { approvedDate: { $ne: null } },
        ],
      }),
      ClientPayment.countDocuments({ buildingId }),
      CompanyExpense.countDocuments({ buildingId, enabled: true, amount: { $gt: 0 } }),
      RestockRequest.countDocuments({ buildingId }),
      Remark.countDocuments({ module: 'buildings', referenceId: String(buildingId) }),
    ]);

    const hasInlineActivity =
      (building.dailyUpdates || []).length > 0 ||
      (building.remarks || []).length > 0;

    const hasRelatedActivity = [
      materialCount,
      paymentCount,
      workCount,
      attendanceCount,
      employeeCount,
      salaryEntryCount,
      approvalCount,
      clientPaymentCount,
      companyExpenseCount,
      restockCount,
      remarkCount,
    ].some((count) => count > 0);

    if (!hasInlineActivity && !hasRelatedActivity) {
      return false;
    }

    return updateBuildingStatusToProcessing(buildingId);
  } catch (error) {
    console.error(`[autoProcessBuildingIfHasActivity] Error for building ${buildingId}: ${error.message}`);
    return false;
  }
}

const updateBuildingToProcessing = updateBuildingStatusToProcessing;

module.exports = {
  updateBuildingStatusToProcessing,
  updateBuildingToProcessing,
  autoProcessBuildingIfHasActivity,
};
