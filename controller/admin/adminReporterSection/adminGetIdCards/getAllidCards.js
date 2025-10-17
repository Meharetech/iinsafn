const genrateIdCard = require("../../../../models/reporterIdGenrate/genrateIdCard");
const sendEmail = require("../../../../utils/sendEmail");
const notifyOnWhatsapp = require("../../../../utils/notifyOnWhatsapp")
const Templates = require("../../../../utils/whatsappTemplates")
const User = require("../../../../models/userModel/userModel")

// ✅ Get all ID cards with status 'Under Review'
// const getAllidCards = async (req, res) => {
//   try {
//     const reportersIdCard = await genrateIdCard.find({
//       status: "Under Review",
//     });
//     res.status(200).json({ success: true, reportersIdCard });
//   } catch (error) {
//     console.error("Error fetching reporters:", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// };




const getAllidCards = async (req, res) => {
  try {
    const reportersIdCard = await genrateIdCard
      .find({ status: "Under Review" })
      .populate("reporter", "iinsafId"); 
      // populate iinsafId from User schema

    res.status(200).json({ success: true, reportersIdCard });
  } catch (error) {
    console.error("Error fetching reporters:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



// Function to generate a unique iinsafId
const generateUniqueIinsafId = async () => {
  let uniqueId;
  let exists = true;

  while (exists) {
    // Generate a random 5-digit number
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `IINSAF${randomNum}`;

    // Check if it already exists
    const existingCard = await genrateIdCard.findOne({ iinsafId: uniqueId });
    if (!existingCard) {
      exists = false;
    }
  }

  return uniqueId;
};



const approveIdCardStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Get today's date
    const today = new Date();

    // Format date to DD/MM/YYYY
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const issuedDate = formatDate(today);

    // Add 1 year for validUpto
    const validUptoDate = new Date(today);
    validUptoDate.setFullYear(validUptoDate.getFullYear() + 1);
    const validUpto = formatDate(validUptoDate);

    // First, get the ID card to check user role
    const existingCard = await genrateIdCard.findById(id).populate('reporter');
    if (!existingCard) {
      return res.status(404).json({
        success: false,
        message: "ID card not found",
      });
    }

    // Generate role-specific ID based on user role
    const generateRoleSpecificId = async (userRole) => {
      let uniqueId;
      let exists = true;
      let prefix;

      if (userRole === "Influencer") {
        prefix = "INF";
      } else {
        prefix = "IINSAF";
      }

      while (exists) {
        // Generate a random 4-digit number
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        uniqueId = `${prefix}${randomNum}`;

        // Check if it already exists
        const existingCard = await genrateIdCard.findOne({ iinsafId: uniqueId });
        exists = !!existingCard;
      }
      return uniqueId;
    };

    const userRole = existingCard.reporter?.role || existingCard.designation;
    const iinsafId = await generateRoleSpecificId(userRole);

    // 🔹 Step 1: Approve ID card and assign iinsafId
    const updatedCard = await genrateIdCard.findByIdAndUpdate(
      id,
      {
        status: "Approved",
        issuedDate,
        validUpto,
        iinsafId,
      },
      { new: true }
    );

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: "ID card not found",
      });
    }

    // 🔹 Step 2: Update linked User by reporter ObjectId
    let updatedUser = null;
    if (updatedCard.reporter) {
      updatedUser = await User.findByIdAndUpdate(
        updatedCard.reporter,
        { iinsafId },
        { new: true }
      );
    }

    //  Send approval email
    if (updatedCard.email) {
      await sendEmail(
        updatedCard.email,
        "✅ ID Card Approved",
        `Hello ${updatedCard.name},\n\nYour ID Card request has been approved.\n\nIssued Date: ${issuedDate}\nValid Upto: ${validUpto}\nYour iInsaf ID: ${iinsafId}\n\nWelcome aboard 🎉\n\nRegards,\nTeam`
      );
    }

    // 📱 Send WhatsApp approval notification
    if (updatedCard.mobileNo) {
      await notifyOnWhatsapp(
        updatedCard.mobileNo,
        Templates.AFTER_ID_CARD_APPROVED_NOTIFY_TO_REPORTER,
        [
          updatedCard.name, // {{1}} reporter name
          issuedDate,       // {{2}} issued date
          validUpto,        // {{3}} valid upto
          iinsafId,         // {{4}} ID card number
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: "ID card approved & iInsafId synced with User",
      data: { updatedCard, updatedUser },
    });
  } catch (error) {
    console.error("Error approving ID card:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};




// ✅ Reject an ID card by ID
const rejectIdCard = async (req, res) => {
  console.log("In the reporter get rejected Id card function");

  try {
    const { id } = req.params;
    const { rejectNote } = req.body; // ✅ Get the rejection reason from the request

    // ✅ Update ID card with status, note, and rejection timestamp
    const updatedCard = await genrateIdCard.findByIdAndUpdate(
      id,
      {
        status: "Rejected",
        rejectNote: rejectNote || "No reason provided",
        rejectedAt: new Date(), // ✅ Set rejection time for TTL
      },
      { new: true }
    );

    if (!updatedCard) {
      return res
        .status(404)
        .json({ success: false, message: "ID card not found" });
    }

    // ✅ Send rejection email
    if (updatedCard.email) {
      await sendEmail(
        updatedCard.email,
        "❌ ID Card Rejected",
        `Hello ${
          updatedCard.name
        },\n\nYour ID Card request has been rejected by the Admin.\nReason: ${
          rejectNote || "No reason provided"
        }.\n\nYou can apply after 24 hours.\n\nRegards,\nTeam IINSAF`
      );
    }

    // 📱 Send WhatsApp rejection notification
    if (updatedCard.mobileNo) {
      await notifyOnWhatsapp(
        updatedCard.mobileNo,
        Templates.AFTER_ID_CARD_REJECTED_NOTIFY_TO_REPORTER, // campaign: after_id_card_rejected_notify_to_reporter
        [
          updatedCard.name, // {{1}} -> reporter name
          rejectNote || "No reason provided", // {{2}} -> rejection reason
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: "ID card rejected successfully (auto-deletes in 24h)",
      data: updatedCard,
    });
  } catch (error) {
    console.error("Error rejecting ID card:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getApprovedCards = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    // Get approved cards sorted by latest first (most recent updatedAt/createdAt)
    const reportersIdCard = await genrateIdCard
      .find({ status: "Approved" })
      .sort({ updatedAt: -1, createdAt: -1 }) // Sort by latest first
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reporter', 'iinsafId name email mobile role');
    
    // Get total count for pagination
    const totalCount = await genrateIdCard.countDocuments({ status: "Approved" });
    
    res.status(200).json({ 
      success: true, 
      reportersIdCard,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching approved ID cards:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getRejectCards = async (req, res) => {
  try {
    const reportersIdCard = await genrateIdCard.find({ status: "Rejected" });
    res.status(200).json({ success: true, reportersIdCard });
  } catch (error) {
    console.error("Error fetching reporters:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  getAllidCards,
  approveIdCardStatus,
  rejectIdCard,
  getApprovedCards,
  getRejectCards,
};
