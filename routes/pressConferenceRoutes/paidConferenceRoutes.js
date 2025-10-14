const express = require("express");
const router = express.Router();

const {
  calculatePaidConferencePrice,
  createPaidConferenceOrder,
  submitPaidConference,
  getUserPaidConferences,
  getAllPaidConferences,
  getPaidConferencesWithProofs,
  adminActionPaidConference,
  verifyPayment,
  getPaymentHistory,
  completePaidConference,
  rejectPaidConferenceProof,
  getPaidConferenceDetails,
  getCompletedPaidConferences,
  manuallyCompleteConference,
  debugPaidConferences,
  getCompletionDetails
} = require("../../controller/pressConference/paidConferenceController");

const pressConferenceAuth = require("../../middlewares/pressConferenceAuth/pressConferenceAuth");
const adminAuthenticate = require("../../middlewares/adminAuthenticate/adminAuthenticate");

// Press Conference User Routes
router.post("/calculate-price", pressConferenceAuth, calculatePaidConferencePrice);
router.post("/create-order", pressConferenceAuth, createPaidConferenceOrder);
router.post("/submit", pressConferenceAuth, submitPaidConference);
router.get("/user-conferences", pressConferenceAuth, getUserPaidConferences);
router.get("/payment/:paymentId", pressConferenceAuth, verifyPayment);
router.get("/payment-history", pressConferenceAuth, getPaymentHistory);

// Admin Routes
router.get("/admin/all", adminAuthenticate, getAllPaidConferences);
router.get("/admin/with-proofs", adminAuthenticate, getPaidConferencesWithProofs);
router.get("/admin/completed", adminAuthenticate, getCompletedPaidConferences);
router.get("/admin/:conferenceId/details", adminAuthenticate, getPaidConferenceDetails);
router.put("/admin/:conferenceId/action", adminAuthenticate, adminActionPaidConference);
router.put("/admin/:conferenceId/complete", adminAuthenticate, completePaidConference);
router.put("/admin/:conferenceId/reject-proof", adminAuthenticate, rejectPaidConferenceProof);
router.put("/admin/:conferenceId/manual-complete", adminAuthenticate, manuallyCompleteConference);
router.get("/admin/:conferenceId/completion-details", adminAuthenticate, getCompletionDetails);
router.get("/admin/debug", adminAuthenticate, debugPaidConferences);

module.exports = router;
