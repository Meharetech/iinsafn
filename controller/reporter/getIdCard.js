const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");
const User = require("../../models/userModel/userModel")

const getIdCard = async (req, res) => {
  try {
    const reporterId = req.user._id;

    // Find ID card by reporter field (not by _id of the document)
    const reportersIdCard = await genrateIdCard.findOne({ reporter: reporterId });

    if (!reportersIdCard) {
      return res.status(404).json({
        success: false,
        message: "No ID card found for this reporter.",
      });
    }

    // Check status and return appropriate response
    const status = reportersIdCard.status;

    if (status === "Approved") {

      //  Update verifiedReporter = true in User collection
      await User.findByIdAndUpdate(reporterId, { verifiedReporter: true });
      return res.status(201).json({
        success: true,
        data: reportersIdCard,
      });
    } else if (status === "Under Review") {
      return res.status(200).json({
        success: false,
        message: "Your ID card is still under review. Please wait for admin approval.",
      });
    } else if (status === "Rejected") {
      return res.status(200).json({
        success: false,
        message: "Your ID card application has been rejected. You are not eligible to work as a reporter.",
        rejectedNote: reportersIdCard.rejectNote || null,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Unknown status on ID card.",
      });
    }

  } catch (error) {
    console.error("Error fetching reporter ID card:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ID card.",
    });
  }
};

module.exports = getIdCard;
