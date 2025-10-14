const express = require("express");
const router = express.Router();
const {
  getAllStudioSubmissions,
  getStudioSubmissionDetails,
  approveStudioSubmission,
  rejectStudioSubmission,
  getStudioStatistics
} = require("../../controller/admin/podcastStudioAdminController");
const adminAuthenticate = require("../../middlewares/adminAuthenticate/adminAuthenticate");

// All routes require admin authentication
router.use(adminAuthenticate);

// Get all studio submissions with filters and pagination
router.get("/studio-submissions", getAllStudioSubmissions);

// Get studio submission details
router.get("/studio-submission/:id", getStudioSubmissionDetails);

// Approve studio submission
router.patch("/studio-submission/:id/approve", approveStudioSubmission);

// Reject studio submission
router.patch("/studio-submission/:id/reject", rejectStudioSubmission);

// Get studio statistics
router.get("/studio-statistics", getStudioStatistics);

module.exports = router;
