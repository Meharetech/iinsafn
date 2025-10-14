const PodcastBooking = require('../../models/podcastBooking/podcastBookingSchema');

/**
 * Submit a new podcast booking request
 */
const submitPodcastBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Extract booking data from request body
    const {
      date,
      startTime,
      endTime,
      duration,
      topic,
      podcastTitle,
      podcastDescription,
      guestName,
      guestEmail,
      guestPhone,
      contactPerson,
      contactPhone,
      contactEmail,
      companyName,
      notes
    } = req.body;

    // Validate required fields
    const requiredFields = ['date', 'startTime', 'endTime', 'topic', 'podcastTitle', 'contactPerson', 'contactPhone', 'contactEmail'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (contactEmail && !emailRegex.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact email format'
      });
    }

    if (guestEmail && !emailRegex.test(guestEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guest email format'
      });
    }

    // Validate phone number format (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (contactPhone && !phoneRegex.test(contactPhone.replace(/\D/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Contact phone must be exactly 10 digits'
      });
    }

    if (guestPhone && !phoneRegex.test(guestPhone.replace(/\D/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Guest phone must be exactly 10 digits'
      });
    }

    // Check if user already has a pending booking for the same date
    const existingBooking = await PodcastBooking.findOne({
      userId: userId,
      date: new Date(date),
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending or confirmed booking for this date'
      });
    }

    // Create new booking
    const booking = new PodcastBooking({
      date: new Date(date),
      startTime,
      endTime,
      duration: parseFloat(duration) || 0,
      topic,
      podcastTitle,
      podcastDescription,
      guestName,
      guestEmail,
      guestPhone,
      contactPerson,
      contactPhone,
      contactEmail,
      companyName,
      notes,
      userId
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Podcast booking request submitted successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        date: booking.date,
        topic: booking.topic,
        podcastTitle: booking.podcastTitle
      }
    });

  } catch (error) {
    console.error('Podcast booking submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit podcast booking request',
      error: error.message
    });
  }
};

/**
 * Get user's podcast bookings
 */
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Build query
    const query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings with pagination
    const bookings = await PodcastBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count
    const totalBookings = await PodcastBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBookings / parseInt(limit)),
          totalBookings,
          hasNext: skip + bookings.length < totalBookings,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

/**
 * Get single booking details
 */
const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    const booking = await PodcastBooking.findOne({
      _id: bookingId,
      userId: userId
    }).select('-__v');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

/**
 * Cancel a booking
 */
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;
    const { cancellationReason } = req.body;

    const booking = await PodcastBooking.findOne({
      _id: bookingId,
      userId: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason || 'Cancelled by user';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        cancelledAt: booking.cancelledAt
      }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
};

module.exports = {
  submitPodcastBooking,
  getUserBookings,
  getBookingDetails,
  cancelBooking
};
