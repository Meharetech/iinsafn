const PodcastStudio = require("../../models/podcastStudio/podcastStudioSchema");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const path = require("path");
const fs = require("fs");

// Register a new podcast studio
const registerPodcastStudio = async (req, res) => {
  try {
    const {
      studioName,
      location,
      address,
      city,
      state,
      pincode,
      contactPerson,
      phone,
      email,
      capacity,
      hourlyRate,
      facilities,
      availability,
      description
    } = req.body;

    // Get owner ID from authenticated user
    const ownerId = req.user.userId;
    
    console.log("User data from middleware:", req.user);
    console.log("Owner ID:", ownerId);

    // Validate required fields
    if (!studioName || !address || !city || !state || !pincode || !contactPerson || !phone || !email || !capacity || !hourlyRate) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Validate images - at least one image is required
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one studio image is required"
      });
    }

    // Check if user already has a pending or approved studio
    const existingUserStudio = await PodcastStudio.findOne({
      ownerId: ownerId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingUserStudio) {
      const statusMessage = existingUserStudio.status === 'pending' 
        ? "You already have a studio registration pending approval. Please wait for 24 hours for review."
        : "You already have an approved studio. You can only register one studio per account.";
      
      return res.status(400).json({
        success: false,
        message: statusMessage,
        existingStudio: {
          id: existingUserStudio._id,
          name: existingUserStudio.studioName,
          status: existingUserStudio.status,
          submittedAt: existingUserStudio.createdAt
        }
      });
    }

    // Check if studio already exists with same name and location (different owner)
    const existingStudio = await PodcastStudio.findOne({
      studioName: { $regex: new RegExp(studioName, 'i') },
      city: { $regex: new RegExp(city, 'i') },
      state: { $regex: new RegExp(state, 'i') },
      ownerId: { $ne: ownerId } // Different owner
    });

    if (existingStudio) {
      return res.status(400).json({
        success: false,
        message: "A studio with this name already exists in the same location by another user"
      });
    }

    // Handle image uploads
    let imageUrls = [];
    console.log("Files received:", req.files);
    
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} images`);
      
      for (const image of req.files) {
        try {
          console.log(`Uploading image: ${image.originalname} from ${image.path}`);
          const result = await uploadToCloudinary(image.path, 'podcast-studios');
          if (result && result.secure_url) {
            imageUrls.push(result.secure_url);
            console.log(`Image uploaded successfully: ${result.secure_url}`);
          } else {
            console.error("Cloudinary upload failed - no secure_url returned");
          }
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
          // Continue with other images even if one fails
        }
      }
    } else {
      console.log("No files received in request");
    }
    
    console.log(`Total images uploaded: ${imageUrls.length}`);

    // Parse JSON fields if they are strings
    let parsedFacilities = facilities;
    let parsedAvailability = availability;

    if (typeof facilities === 'string') {
      try {
        parsedFacilities = JSON.parse(facilities);
      } catch (e) {
        parsedFacilities = [];
      }
    }

    if (typeof availability === 'string') {
      try {
        parsedAvailability = JSON.parse(availability);
      } catch (e) {
        parsedAvailability = {};
      }
    }

    // Create new studio
    const newStudio = new PodcastStudio({
      studioName,
      location,
      address,
      city,
      state,
      pincode,
      contactPerson,
      phone,
      email,
      capacity: parseInt(capacity),
      hourlyRate: parseFloat(hourlyRate),
      facilities: parsedFacilities,
      availability: parsedAvailability,
      description,
      images: imageUrls,
      ownerId
    });

    await newStudio.save();

    // Clean up temporary files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`Cleaned up temporary file: ${file.path}`);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Studio registration submitted successfully! We'll review and get back to you soon.",
      data: {
        studioId: newStudio._id,
        studioName: newStudio.studioName,
        status: newStudio.status,
        imagesCount: imageUrls.length
      }
    });

  } catch (error) {
    console.error("Studio registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get all studios (for booking)
const getAllStudios = async (req, res) => {
  try {
    const { state, city, minPrice, maxPrice, capacity, facilities } = req.query;
    
    let query = { status: 'approved', isActive: true };

    // Add filters
    if (state) {
      query.state = new RegExp(state, 'i');
    }
    if (city) {
      query.city = new RegExp(city, 'i');
    }
    if (minPrice || maxPrice) {
      query.hourlyRate = {};
      if (minPrice) query.hourlyRate.$gte = parseFloat(minPrice);
      if (maxPrice) query.hourlyRate.$lte = parseFloat(maxPrice);
    }
    if (capacity) {
      query.capacity = { $gte: parseInt(capacity) };
    }
    if (facilities) {
      const facilityArray = facilities.split(',');
      query.facilities = { $in: facilityArray };
    }

    const studios = await PodcastStudio.find(query)
      .populate('ownerId', 'name email phoneNo')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: studios
    });

  } catch (error) {
    console.error("Get studios error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get studio by ID
const getStudioById = async (req, res) => {
  try {
    const { id } = req.params;

    const studio = await PodcastStudio.findById(id)
      .populate('ownerId', 'name email phoneNo');

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found"
      });
    }

    res.status(200).json({
      success: true,
      data: studio
    });

  } catch (error) {
    console.error("Get studio error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get studios by owner
const getStudiosByOwner = async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const studios = await PodcastStudio.find({ ownerId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: studios
    });

  } catch (error) {
    console.error("Get owner studios error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Get user's studio submission status
const getStudioSubmissionStatus = async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const studio = await PodcastStudio.findOne({ ownerId })
      .sort({ createdAt: -1 });

    if (!studio) {
      return res.status(200).json({
        success: true,
        data: {
          hasStudio: false,
          canSubmit: true,
          message: "No studio registration found. You can submit a new registration."
        }
      });
    }

    const canSubmit = studio.status === 'rejected';
    let message = "";

    switch (studio.status) {
      case 'pending':
        message = "Your studio registration is pending approval. Please wait for 24 hours for review.";
        break;
      case 'approved':
        message = "Your studio has been approved! You can manage it from the dashboard.";
        break;
      case 'rejected':
        message = "Your previous studio registration was rejected. You can submit a new registration.";
        break;
      default:
        message = "Unknown status. Please contact support.";
    }

    res.status(200).json({
      success: true,
      data: {
        hasStudio: true,
        canSubmit: canSubmit,
        studio: {
          id: studio._id,
          name: studio.studioName,
          status: studio.status,
          submittedAt: studio.createdAt,
          updatedAt: studio.updatedAt,
          rejectionReason: studio.rejectionReason || '',
          adminNotes: studio.adminNotes || '',
          rejectedAt: studio.rejectedAt || null,
          approvedAt: studio.approvedAt || null
        },
        message: message
      }
    });

  } catch (error) {
    console.error("Get studio submission status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

// Update studio status (admin only)
const updateStudioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be pending, approved, or rejected"
      });
    }

    const studio = await PodcastStudio.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Studio ${status} successfully`,
      data: studio
    });

  } catch (error) {
    console.error("Update studio status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
};

module.exports = {
  registerPodcastStudio,
  getAllStudios,
  getStudioById,
  getStudiosByOwner,
  getStudioSubmissionStatus,
  updateStudioStatus
};
