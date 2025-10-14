const express = require('express');
const router = express.Router();
const adminAuthenticate = require('../../middlewares/adminAuthenticate/adminAuthenticate');
const {
  getAllBookings,
  getBookingDetails,
  approveBooking,
  rejectBooking,
  completeBooking,
  getBookingStatistics
} = require('../../controller/admin/podcastBookingAdminController');

/**
 * @route   GET /admin/podcast-bookings
 * @desc    Get all podcast bookings with filtering, pagination, and search
 * @access  Private (Admin)
 */
router.get('/podcast-bookings', adminAuthenticate, getAllBookings);

/**
 * @route   GET /admin/podcast-booking/:bookingId
 * @desc    Get single booking details
 * @access  Private (Admin)
 */
router.get('/podcast-booking/:bookingId', adminAuthenticate, getBookingDetails);

/**
 * @route   PATCH /admin/podcast-booking/:bookingId/approve
 * @desc    Approve/confirm a booking
 * @access  Private (Admin)
 */
router.patch('/podcast-booking/:bookingId/approve', adminAuthenticate, approveBooking);

/**
 * @route   PATCH /admin/podcast-booking/:bookingId/reject
 * @desc    Reject a booking with reason
 * @access  Private (Admin)
 */
router.patch('/podcast-booking/:bookingId/reject', adminAuthenticate, rejectBooking);

/**
 * @route   PATCH /admin/podcast-booking/:bookingId/complete
 * @desc    Mark booking as completed
 * @access  Private (Admin)
 */
router.patch('/podcast-booking/:bookingId/complete', adminAuthenticate, completeBooking);

/**
 * @route   GET /admin/podcast-booking-statistics
 * @desc    Get booking statistics
 * @access  Private (Admin)
 */
router.get('/podcast-booking-statistics', adminAuthenticate, getBookingStatistics);

module.exports = router;
