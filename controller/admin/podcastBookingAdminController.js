const PodcastBooking = require('../../models/podcastBooking/podcastBookingSchema');
const PodcastUser = require('../../models/podcastUser/podcastUserSchema');

/**
 * Get all podcast bookings with filtering, pagination, and search
 */
const getAllBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'all', 
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: 'i' } },
        { podcastTitle: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { guestName: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get bookings with user details
    const bookings = await PodcastBooking.find(query)
      .populate('userId', 'name email phoneNo')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get total count
    const totalBookings = await PodcastBooking.countDocuments(query);

    // Get statistics
    const stats = await PodcastBooking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

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
        },
        statistics: {
          total: totalBookings,
          ...statusCounts
        }
      }
    });

  } catch (error) {
    console.error('Get all bookings error:', error);
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

    const booking = await PodcastBooking.findById(bookingId)
      .populate('userId', 'name email phoneNo aadharNo pancard')
      .select('-__v');

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
 * Approve/Confirm a booking
 */
const approveBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.userId;

    const booking = await PodcastBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already confirmed'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve a cancelled booking'
      });
    }

    // Update booking status
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    booking.confirmedBy = adminId;
    booking.adminNotes = adminNotes || '';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking approved successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        confirmedAt: booking.confirmedAt
      }
    });

  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve booking',
      error: error.message
    });
  }
};

/**
 * Reject a booking
 */
const rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user.userId;

    const booking = await PodcastBooking.findById(bookingId);

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
        message: 'Cannot reject a completed booking'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.rejectedAt = new Date();
    booking.rejectedBy = adminId;
    booking.rejectionReason = rejectionReason || 'Rejected by admin';
    booking.adminNotes = adminNotes || '';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        rejectedAt: booking.rejectedAt,
        rejectionReason: booking.rejectionReason
      }
    });

  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: error.message
    });
  }
};

/**
 * Mark booking as completed
 */
const completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.userId;

    const booking = await PodcastBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be marked as completed'
      });
    }

    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.completedBy = adminId;
    booking.adminNotes = adminNotes || booking.adminNotes || '';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        completedAt: booking.completedAt
      }
    });

  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete booking',
      error: error.message
    });
  }
};

/**
 * Get booking statistics
 */
const getBookingStatistics = async (req, res) => {
  try {
    const stats = await PodcastBooking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const totalBookings = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    res.status(200).json({
      success: true,
      data: {
        total: totalBookings,
        ...statusCounts
      }
    });

  } catch (error) {
    console.error('Get booking statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllBookings,
  getBookingDetails,
  approveBooking,
  rejectBooking,
  completeBooking,
  getBookingStatistics
};
