const Coupon = require("../../../../models/adminModels/genrateCoupon/createCoupon");
const AdPost = require("../../../../models/advertismentPost/advertisementPost")

const generateCoupon = async (req, res) => {
  try {
    const {
      code,
      discount,
      type,
      validFrom,
      validUntil,
      usageLimit,
      minPurchase,
      status,
      description
    } = req.body;

    // Check if coupon already exists
    const existing = await Coupon.findOne({ code });
    if (existing) {
      return res.status(400).json({ success: false, message: "Coupon already exists" });
    }

    const newCoupon = new Coupon({
      code,
      discount: Number(discount),
      type: type.toLowerCase(),
      validFrom,
      validUntil,
      usageLimit: Number(usageLimit),
      minPurchase: Number(minPurchase),
      status: status.toLowerCase(),
      description
    });

    await newCoupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon: newCoupon
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }); // optional: sort by latest
    res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
};

const deleteCoupon = async (req, res) => {
  const { id } = req.params; // assuming you're using DELETE /coupon/:id

  try {
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    await Coupon.findByIdAndDelete(id);

    return res.status(200).json({ message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({ message: "Server error while deleting coupon." });
  }
};

// ✅ Get Coupon History (only ads with couponCode)
const getCouponHistory = async (req, res) => {
  try {
    const adsWithCoupons = await AdPost.find(
      { couponCode: { $exists: true, $ne: "" } }, // only where couponCode is applied
      {
        adType: 1,
        owner: 1,
        couponCode: 1,
        subtotal: 1,
        gst: 1,
        totalCost: 1,
        status: 1,
        createdAt: 1,
        mediaType: 1,
        mediaDescription: 1,
      }
    )
      .populate("owner", "name email mobile iinsafId") // ✅ include iinsafId
      .sort({ createdAt: -1 });

    if (!adsWithCoupons.length) {
      return res.status(404).json({
        success: false,
        message: "No ads found with applied coupon codes",
      });
    }

    res.status(200).json({
      success: true,
      message: "Coupon history fetched successfully",
      data: adsWithCoupons,
    });
  } catch (error) {
    console.error("Error fetching coupon history:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching coupon history",
    });
  }
};


module.exports = { generateCoupon, getAllCoupons, deleteCoupon, getCouponHistory}
