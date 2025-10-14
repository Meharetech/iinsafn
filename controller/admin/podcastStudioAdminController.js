const PodcastStudio = require("../../models/podcastStudio/podcastStudioSchema");
const PodcastUser = require("../../models/podcastUser/podcastUserSchema");

// Get all studio submissions for admin review
const getAllStudioSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { studioName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const studios = await PodcastStudio.find(query)
      .populate('ownerId', 'name email phoneNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PodcastStudio.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get status counts
    const statusCounts = await PodcastStudio.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCountsObj = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        studios,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        statusCounts: {
          pending: statusCountsObj.pending || 0,
          approved: statusCountsObj.approved || 0,
          rejected: statusCountsObj.rejected || 0,
          total: total
        }
      }
    });

  } catch (error) {
    console.error("Get studio submissions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get single studio submission details
const getStudioSubmissionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const studio = await PodcastStudio.findById(id)
      .populate('ownerId', 'name email phoneNo aadharNo pancard');

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio submission not found"
      });
    }

    res.status(200).json({
      success: true,
      data: studio
    });

  } catch (error) {
    console.error("Get studio submission details error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Approve studio submission
const approveStudioSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const studio = await PodcastStudio.findById(id);

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio submission not found"
      });
    }

    if (studio.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Studio is already ${studio.status}. Cannot change status.`
      });
    }

    // Update studio status
    studio.status = 'approved';
    studio.adminNotes = adminNotes || '';
    studio.approvedAt = new Date();
    studio.approvedBy = req.user.userId; // Admin user ID

    await studio.save();

    // Update user's studio count or other relevant fields
    await PodcastUser.findByIdAndUpdate(studio.ownerId, {
      $inc: { 'podcastStats.studios': 1 }
    });

    res.status(200).json({
      success: true,
      message: "Studio submission approved successfully",
      data: {
        studioId: studio._id,
        studioName: studio.studioName,
        status: studio.status,
        approvedAt: studio.approvedAt
      }
    });

  } catch (error) {
    console.error("Approve studio submission error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Reject studio submission
const rejectStudioSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    const studio = await PodcastStudio.findById(id);

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio submission not found"
      });
    }

    if (studio.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Studio is already ${studio.status}. Cannot change status.`
      });
    }

    // Update studio status
    studio.status = 'rejected';
    studio.rejectionReason = rejectionReason;
    studio.adminNotes = adminNotes || '';
    studio.rejectedAt = new Date();
    studio.rejectedBy = req.user.userId; // Admin user ID

    await studio.save();

    res.status(200).json({
      success: true,
      message: "Studio submission rejected successfully",
      data: {
        studioId: studio._id,
        studioName: studio.studioName,
        status: studio.status,
        rejectionReason: studio.rejectionReason,
        rejectedAt: studio.rejectedAt
      }
    });

  } catch (error) {
    console.error("Reject studio submission error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get studio statistics for admin dashboard
const getStudioStatistics = async (req, res) => {
  try {
    const totalStudios = await PodcastStudio.countDocuments();
    const pendingStudios = await PodcastStudio.countDocuments({ status: 'pending' });
    const approvedStudios = await PodcastStudio.countDocuments({ status: 'approved' });
    const rejectedStudios = await PodcastStudio.countDocuments({ status: 'rejected' });

    // Recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSubmissions = await PodcastStudio.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Monthly statistics
    const monthlyStats = await PodcastStudio.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStudios,
        pendingStudios,
        approvedStudios,
        rejectedStudios,
        recentSubmissions,
        monthlyStats
      }
    });

  } catch (error) {
    console.error("Get studio statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

module.exports = {
  getAllStudioSubmissions,
  getStudioSubmissionDetails,
  approveStudioSubmission,
  rejectStudioSubmission,
  getStudioStatistics
};
