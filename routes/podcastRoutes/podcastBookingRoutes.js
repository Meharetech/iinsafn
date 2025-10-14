const express = require('express');
const router = express.Router();
const podcastAuthenticate = require('../../middlewares/podcastAuth/podcastAuthenticate');
const {
  submitPodcastBooking,
  getUserBookings,
  getBookingDetails,
  cancelBooking
} = require('../../controller/podcast/podcastBookingController');

/**
 * @route   POST /podcast/booking/submit
 * @desc    Submit a new podcast booking request
 * @access  Private (Podcast User)
 */
router.post('/booking/submit', podcastAuthenticate, submitPodcastBooking);

/**
 * @route   GET /podcast/booking/my-bookings
 * @desc    Get user's podcast bookings with pagination and filtering
 * @access  Private (Podcast User)
 */
router.get('/booking/my-bookings', podcastAuthenticate, getUserBookings);

/**
 * @route   GET /podcast/booking/:bookingId
 * @desc    Get single booking details
 * @access  Private (Podcast User)
 */
router.get('/booking/:bookingId', podcastAuthenticate, getBookingDetails);

/**
 * @route   PATCH /podcast/booking/:bookingId/cancel
 * @desc    Cancel a booking
 * @access  Private (Podcast User)
 */
router.patch('/booking/:bookingId/cancel', podcastAuthenticate, cancelBooking);

module.exports = router;
