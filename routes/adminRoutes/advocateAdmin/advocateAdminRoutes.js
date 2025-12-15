const express = require("express");
const router = express.Router();
const adminGetAllAdvocates = require("../../../controller/admin/adminAdvocateSection/adminGetAllAdvocates");
const { approveAdvocate, rejectAdvocate } = require("../../../controller/admin/adminAdvocateSection/adminApproveAdvocate");
const deleteAdvocate = require("../../../controller/admin/adminAdvocateSection/adminDeleteAdvocate");
const verifyAdminAccess = require("../../../middlewares/adminAuthenticate/verifyAdminAccess");

const adminAuthenticate = require("../../../middlewares/adminAuthenticate/adminAuthenticate");

// Protected route for admin to get all advocates
router.get("/admin/advocates/all", adminAuthenticate, verifyAdminAccess("advocate"), adminGetAllAdvocates);

// Approve/Reject routes
router.put("/admin/advocate/approve/:id", adminAuthenticate, verifyAdminAccess("advocate"), approveAdvocate);
router.put("/admin/advocate/reject/:id", adminAuthenticate, verifyAdminAccess("advocate"), rejectAdvocate);

// Delete route
router.delete("/admin/advocate/delete/:id", adminAuthenticate, verifyAdminAccess("advocate"), deleteAdvocate);

module.exports = router;
