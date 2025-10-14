const express = require("express");
const router = express.Router();
const {
  submitFreeConference,
  getAllFreeConferences,
  getFreeConferenceById,
  adminAction,
  getUserConferences,
  testConferenceData,
  getCompletedConferences,
  getModifiedConferences,
  adminRejectConferenceProof,
  adminApproveConferenceProof,
} = require("../../controller/pressConference/freeConferenceController");
const pressConferenceAuth = require("../../middlewares/pressConferenceAuth/pressConferenceAuth");
const adminAuthenticate = require("../../middlewares/adminAuthenticate/adminAuthenticate");

// Protected routes (require press conference authentication)
router.post("/submit", pressConferenceAuth, submitFreeConference);
router.get("/user-conferences", pressConferenceAuth, getUserConferences);

// Admin routes
router.get("/admin/all", adminAuthenticate, getAllFreeConferences);
router.get("/admin/completed", adminAuthenticate, getCompletedConferences);
router.get("/admin/modified", adminAuthenticate, getModifiedConferences);
router.get("/admin/:id", adminAuthenticate, getFreeConferenceById);
router.put("/admin/:id/action", adminAuthenticate, adminAction);
router.put("/admin/:conferenceId/proof/:reporterId/reject", adminAuthenticate, adminRejectConferenceProof);
router.put("/admin/:conferenceId/proof/:reporterId/approve", adminAuthenticate, adminApproveConferenceProof);

// Test route for debugging


module.exports = router;
