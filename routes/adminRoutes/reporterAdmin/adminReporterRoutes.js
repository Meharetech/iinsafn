const express = require("express");
const router = express.Router();
const multer = require("../../../middlewares/multer/multer");

const getAllReporter = require("../../../controller/admin/adminReporterSection/adminGetAllReporter/getAllReporter");
const getLocationUsers = require("../../../controller/admin/adminReporterSection/adminGetAllReporter/getLocationUsers");
const {
  generateCoupon,
  getAllCoupons,
  deleteCoupon,
  getCouponHistory
} = require("../../../controller/admin/adminReporterSection/adminGenrateCoupon/genrateCoupon");

const {
  getAllidCards,
  approveIdCardStatus,
  rejectIdCard,
  getApprovedCards,
  getRejectCards,
} = require("../../../controller/admin/adminReporterSection/adminGetIdCards/getAllidCards");

const {
  getCompletedAds,
  adminApproveAdsProof,
  adminRejectAdsProof,
  getFinalCompletedAds
} = require("../../../controller/admin/adminReporterSection/adminGetCompletedAds/getCompletedAds");

const adminAuthenticate = require("../../../middlewares/adminAuthenticate/adminAuthenticate");
const verifyAdminAccess = require("../../../middlewares/adminAuthenticate/verifyAdminAccess");
const isSuperAdmin = require("../../../middlewares/adminAuthenticate/isSuperAdmin");
const adminUpdateIdCard = require("../../../controller/admin/adminReporterSection/adminUpdateReporterIdCard/adminUpdateIdCard")
const {getAllWithdrawalRequests, rejectWithdrawal, approveWithdrawal} = require("../../../controller/admin/adminReporterSection/adminGetAllWithdrawRequest/getAllWithdrawalRequests");


//free ads
const {
  getPendingFreeAds,
  getApprovedFreeAds,
  getRunningFreeAds,
  getCompletedFreeAds,
  getFreeAdTargetedUsers,
} = require("../../../controller/admin/adminReporterSection/FreeAds/freeAdStatusAdmin")

const modifyFreeAd = require("../../../controller/admin/freeAds/modifyFreeAd")

const {proofAccept,proofReject} = require("../../../controller/admin/adminReporterSection/FreeAds/proofAcceptReject")

// Running conferences
const {getRunningConferences, getConferenceWithReporters, getConferenceReporters, deleteReporterFromConference, getConferenceTargetedReporters} = require("../../../controller/admin/adminReporterSection/getRunningConferences")

// Running paid conferences
const {getRunningPaidConferences, getPaidConferenceWithReporters, getPaidConferenceReporters, deleteReporterFromPaidConference, getPaidConferenceTargetedReporters} = require("../../../controller/admin/adminReporterSection/getRunningPaidConferences")

// Conference proof management
const {approveConferenceProof, rejectConferenceProof, getConferencesWithProofs} = require("../../../controller/admin/adminReporterSection/approveRejectConferenceProof")


router.post("/genrate/coupon", adminAuthenticate, isSuperAdmin, generateCoupon);
router.get("/get/all/coupons",adminAuthenticate, isSuperAdmin, getAllCoupons);
router.delete("/delete/coupon/:id",adminAuthenticate,isSuperAdmin,deleteCoupon)
router.get("/coupon/history", adminAuthenticate, isSuperAdmin, getCouponHistory);


router.get(
  "/admin/get/all/reporter",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getAllReporter
);

router.get(
  "/admin/get/all/influencer",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getAllReporter
);

// ✅ New API for location-based user filtering
router.get(
  "/admin/get/location/users",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getLocationUsers
);

router.get(
  "/admin/get/icards",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getAllidCards
);
router.put(
  "/idcards/approve/:id",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  approveIdCardStatus
);
router.put(
  "/idcards/reject/:id",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  rejectIdCard
);
router.get(
  "/get/approved/icards",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getApprovedCards
);
router.get(
  "/get/rejected/icards",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getRejectCards
);

router.get(
  "/admin/get/completed/ads",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getCompletedAds
);

router.put(
  "/admin/approve/completed/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  adminApproveAdsProof
);

router.put(
  "/admin/reject/completed/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  adminRejectAdsProof
);

router.get(
  "/admin/get/withdrawals/requests",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getAllWithdrawalRequests
);

router.put(
  "/admin/withdrawals/approve/:id",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  approveWithdrawal
);

router.put("/admin/withdrawals/:id/reject",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  rejectWithdrawal
);

router.put("/admin/update/reporter/id/card/:id",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  multer.reporterIdCardUpload,
  adminUpdateIdCard
);

router.get("/admin/get/final/completed/ads",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getFinalCompletedAds
)


//free Ad section

router.get("/admin/get/pending/free/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getPendingFreeAds,
)
router.get("/admin/get/free/ad/:adId/targeted-users",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getFreeAdTargetedUsers,
)
router.put("/admin/modify/free/ad/:adId",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  modifyFreeAd,
)
router.get("/admin/get/accepted/reporters/free/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getApprovedFreeAds,
)
router.get("/admin/get/running/free/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getRunningFreeAds,
)
router.get("/admin/get/completed/free/ad",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getCompletedFreeAds,
)

router.put("/admin/accept/free/ad/proof",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  proofAccept
)

router.put("/admin/reject/free/ad/proof",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  proofReject
)

// Running conferences routes
router.get("/admin/get/running/conferences",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getRunningConferences
)

router.get("/admin/get/conference/:conferenceId/all-reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getConferenceReporters
)

router.get("/admin/get/conference/:conferenceId/reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getConferenceWithReporters
)

// Conference proof management routes
router.get("/admin/get/conferences/with-proofs",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getConferencesWithProofs
)

router.put("/admin/approve/conference/proof/:conferenceId/:reporterId",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  approveConferenceProof
)

router.put("/admin/reject/conference/proof/:conferenceId/:reporterId",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  rejectConferenceProof
)

// Delete reporter from conference
router.delete("/admin/delete/reporter/:conferenceId/:reporterId",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  deleteReporterFromConference
)

// Get all reporters who have the conference in their panel (targeted reporters)
router.get("/admin/get/conference/:conferenceId/targeted-reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getConferenceTargetedReporters
)

// Running paid conferences routes
router.get("/admin/get/running/paid-conferences",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getRunningPaidConferences
)

router.get("/admin/get/paid-conference/:conferenceId/all-reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getPaidConferenceReporters
)

router.get("/admin/get/paid-conference/:conferenceId/reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getPaidConferenceWithReporters
)

// Delete reporter from paid conference
router.delete("/admin/delete/paid-conference/reporter/:conferenceId/:reporterId",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  deleteReporterFromPaidConference
)

// Get all reporters who have the paid conference in their panel (targeted reporters)
router.get("/admin/get/paid-conference/:conferenceId/targeted-reporters",
  adminAuthenticate,
  verifyAdminAccess("reporter"),
  getPaidConferenceTargetedReporters
)

module.exports = router;
