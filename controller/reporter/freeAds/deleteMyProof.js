const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const FreeAdProof = require("../../../models/adminModels/freeAds/freeAdProofSchema");

const deleteMyProof = async (req, res) => {
  try {
    const reporterId = req.user._id; // From authentication middleware
    const { adId } = req.params; // adId in params

    if (!adId) {
      return res.status(400).json({
        success: false,
        message: "adId is required"
      });
    }

    // Ensure adId is ObjectId if needed
    const adObjectId = mongoose.Types.ObjectId.isValid(adId)
      ? new mongoose.Types.ObjectId(adId)
      : adId;

    // Find the proof for this reporter and ad
    const proof = await FreeAdProof.findOne({
      adId: adObjectId,
      reporterId
    });

    if (!proof) {
      return res.status(404).json({
        success: false,
        message: "Proof not found or not authorized"
      });
    }

    // Remove screenshot file if exists
    if (proof.screenshot) {
      const filePath = path.join(__dirname, "../../../", proof.screenshot);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete the proof document
    await FreeAdProof.deleteOne({ _id: proof._id });

    res.status(200).json({
      success: true,
      message: "Proof deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting proof:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting proof"
    });
  }
};

module.exports = deleteMyProof;
