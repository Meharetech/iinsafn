const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");
const Coupon = require("../../models/adminModels/genrateCoupon/createCoupon");

const calculateFinalPrice = async (req, res) => {
  try {
    const { adType, requiredViews, days, adLength, cities, CouponCode } = req.body;

    if (!adType || !requiredViews || !adLength || !days) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (isNaN(Number(requiredViews)) || isNaN(Number(adLength)) || isNaN(Number(days))) {
      return res.status(400).json({ success: false, message: "Invalid numeric values" });
    }

    const pricing = await AdPricing.findOne();
    if (!pricing) {
      return res.status(404).json({ success: false, message: "Pricing data not found" });
    }

    const { perSecPrice, gstRate, perCityPrice, baseView } = pricing;
    const citiesCost = cities * perCityPrice;

    const matchedAdType = pricing.adType.find(type => type.name === adType);
    if (!matchedAdType) {
      return res.status(400).json({ success: false, message: "Invalid ad type" });
    }

    const perAdTypePrice = matchedAdType.price;
    const views = Number(requiredViews);
    const duration = Number(adLength);

    const viewCost = perAdTypePrice * views;
    const durationCost = perSecPrice * duration;
    const totalBaseCost = (viewCost + durationCost + citiesCost) * days;
    const gstAmount = (gstRate / 100) * totalBaseCost;
    let finalPrice = totalBaseCost + gstAmount;

    let discountAmount = 0;
    let couponStatus = null;

    // If a coupon was applied
    if (CouponCode) {
      const coupon = await Coupon.findOne({ code: CouponCode, status: 'active' });

      if (!coupon) {
        couponStatus = "Invalid or inactive coupon";
      } else if (new Date(coupon.validUntil) < new Date()) {
        couponStatus = "Coupon has expired";
      } else if (coupon.usedCount >= coupon.usageLimit) {
        couponStatus = "Coupon usage limit has been reached";
      } else if (finalPrice < coupon.minPurchase) {
        couponStatus = `Minimum purchase ₹${coupon.minPurchase} required to use this coupon`;
      } else {
        // Apply discount based on type
        if (coupon.type === 'percentage') {
          discountAmount = (coupon.discount / 100) * finalPrice;
        } else if (coupon.type === 'flat') {
          discountAmount = coupon.discount;
        }

        discountAmount = Math.min(discountAmount, finalPrice);
        finalPrice = finalPrice - discountAmount;
        finalPrice = parseFloat(finalPrice.toFixed(2));
        couponStatus = "Coupon applied successfully";
      }
    }



    const requiredReporter = Math.ceil(views / baseView);

    return res.status(200).json({
      success: true,
      message: "Final price calculated successfully",
      data: {
        viewCost,
        durationCost,
        totalBaseCost,
        gstAmount,
        requiredReporter,
        discountAmount,
        couponStatus,
        finalPrice: Math.max(0, finalPrice) // already rounded above
      }
    });

  } catch (error) {
    console.error("Error in calculateFinalPrice:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = calculateFinalPrice;
