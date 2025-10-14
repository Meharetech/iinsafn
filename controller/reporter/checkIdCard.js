const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

const checkIdCard = async (req, res) => {
  try {
    // reporterId comes from decoded token (set by userAuthenticate middleware)
    const reporterId = req.user._id;

    const existingCard = await genrateIdCard.findOne({ reporter: reporterId });

    if (existingCard) {
      return res.status(200).json({
        exists: true,
        status: existingCard.status,
        data: existingCard,
      });
    }

    return res.status(200).json({
      exists: false,
      message: "No ID card application found for this reporter.",
    });
  } catch (error) {
    console.error("Error checking ID card:", error.message);
    res.status(500).json({
      message: "Server error while checking ID card",
      error: error.message,
    });
  }
};

module.exports = checkIdCard;
