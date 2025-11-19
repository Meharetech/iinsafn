const express = require("express");
const router = express.Router();
const {adminRegistration, verifyAdminOtp, adminLogin} = require("../../../controller/admin/adminRegistration/adminRegistration");
const Admin = require("../../../models/adminModels/adminRegistration/adminSchema");
const adminAuthenticate = require('../../../middlewares/adminAuthenticate/adminAuthenticate')
// const verifyAdminAccess = require('../../../middlewares/adminAuthenticate/verifyAdminAccess')
const isSuperAdmin = require('../../../middlewares/adminAuthenticate/isSuperAdmin')
const {createSubAdmin, deleteSubAdmin, updateSubAdmin, getSubAdminById} = require('../../../controller/admin/adminRegistration/createSubAdmin');
const getAllAdmins = require('../../../controller/admin/adminRegistration/getAllAdmins')
const getAdminProfile = require('../../../controller/admin/adminProfile/getAdminProfile');
const {getRaiseYourVoiceUsers,
  getTotalUsers,
  getTotalAdvertisers,
  getUnverifiedReporters} = require("../../../controller/admin/adminDashboardStats/adminGetAllUsersOnDashboard")

// for dashboard stats

const {dashboardStats , ryvUserStats , getFreeAdsStats} = require("../../../controller/admin/adminDashboardStats/dashboardStats")
const {getAllPayments, adminGetReportersWithdrawlHistory, getAllRefunds} = require("../../../controller/admin/ToatalEarning/Revenue")
const getWalletByPaymentId = require("../../../controller/admin/wallet/getWalletByPaymentId")
const {clearAllPaymentsAndWallets, getPaymentsAndWalletsSummary} = require("../../../controller/admin/clearAllPaymentsAndWallets")

// Middleware: allow /register only if no superadmin exists
const allowFirstSuperAdminOnly = async (req, res, next) => {
  const superAdminExists = await Admin.findOne({ role: "superadmin" });
  if (superAdminExists) {
    return res.status(403).json({ message: "Superadmin already exists. Registration closed." });
  }
  next();
};

router.post("/register/admin/sendotp", allowFirstSuperAdminOnly, adminRegistration);
router.post("/register/verify/otp", verifyAdminOtp);


router.post("/admin/login",adminLogin);
router.get("/get/admin/profile",adminAuthenticate,getAdminProfile)


router.post("/superadmin/create/subadmin",adminAuthenticate,isSuperAdmin,createSubAdmin)
router.get("/super/admin/get/all/admins",adminAuthenticate,isSuperAdmin,getAllAdmins)
router.delete("/super/admin/delete/subadmin/:id",adminAuthenticate,isSuperAdmin,deleteSubAdmin)
// ✅ Get subadmin details by ID (for edit page)
router.get("/super/admin/get/subadmin/:id", adminAuthenticate, isSuperAdmin, getSubAdminById);

// ✅ Update subadmin details
router.put("/super/admin/update/subadmin/:id", adminAuthenticate, isSuperAdmin, updateSubAdmin);



// admin dashboard routs for stats showing

router.get("/admin/get/all/users",adminAuthenticate,isSuperAdmin,dashboardStats)
router.get("/admin/get/all/ryv/user",adminAuthenticate,isSuperAdmin,ryvUserStats)
router.get("/admin/get/free/ad/stats",adminAuthenticate,isSuperAdmin,getFreeAdsStats)


// ✅ Routes for showing user on dashboard
router.get("/super/admin/get/users/raise/your/voice",  getRaiseYourVoiceUsers);
router.get("/super/admin/get/total/users/", getTotalUsers);
router.get("/super/admin/get/total/advertisers",getTotalAdvertisers);
router.get("/super/admin/get/all/unverified/reporters",getUnverifiedReporters);



// for revenew

router.get("/admin/get/revenew",adminAuthenticate,isSuperAdmin,getAllPayments)
router.get("/admin/get/reporters/withdrawl/history",adminAuthenticate,isSuperAdmin,adminGetReportersWithdrawlHistory)
router.get("/admin/get/refund/history",adminAuthenticate,isSuperAdmin,getAllRefunds)
router.get("/admin/get/wallet/by-payment-id/:paymentId",adminAuthenticate,isSuperAdmin,getWalletByPaymentId)

// ⚠️ DANGER ZONE: Clear all payment history, wallets, withdrawal requests, and withdrawal history
router.get("/admin/payments-wallets/summary",adminAuthenticate,isSuperAdmin,getPaymentsAndWalletsSummary)
router.post("/admin/clear/all/payments-and-wallets",adminAuthenticate,isSuperAdmin,clearAllPaymentsAndWallets)

module.exports = router;
