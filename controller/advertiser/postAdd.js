// const uploadToCloudinary = require("../../utils/uploadToCloudinary");
// const Adpost = require("../../models/advertismentPost/advertisementPost");
// const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");
// const Coupon = require("../../models/adminModels/genrateCoupon/createCoupon");
// const applyWatermark = require("../../utils/applyWatermark");
// const fs = require("fs");

// const postAdd = async (req, res) => {
//   try {
//     const body = req.body;

//     // ✅ Required fields check
//     const requiredFields = [
//       "adType",
//       "requiredViews",
//       "adState",
//       "adCity",
//       "mediaType",
//       "adLength",
//       "startDate",
//       "endDate",
//       "subtotal",
//       "gst",
//       "totalCost",
//     ];

//     for (const field of requiredFields) {
//       const value = body[field];
//       if (!value || (typeof value === "string" && value.trim() === "")) {
//         return res.status(400).json({
//           success: false,
//           message: `Field '${field}' is required.`,
//         });
//       }
//     }

//     const imageFile = req.files?.image?.[0];
//     const videoFile = req.files?.video?.[0];

//     let imageUrl = "";
//     let videoUrl = "";

//     if (imageFile) {
//       console.log("📸 Original image:", imageFile.path);
//       const watermarkedImage = await applyWatermark(imageFile.path, "image");
//       console.log(
//         "📸 Watermarked image path received from applyWatermark:",
//         watermarkedImage
//       );

//       const imageUpload = await uploadToCloudinary(
//         watermarkedImage,
//         "ads/images"
//       );
//       imageUrl = imageUpload?.secure_url;

//       // Delete temp file
//       if (fs.existsSync(watermarkedImage)) {
//         console.log("🧼 Deleting watermarked image:", watermarkedImage);
//         fs.unlinkSync(watermarkedImage);
//       } else {
//         console.warn("⚠️ Watermarked image not found:", watermarkedImage);
//       }
//     }

//     if (videoFile) {
//       console.log("🎥 Original video:", videoFile.path);
//       const watermarkedVideo = await applyWatermark(videoFile.path, "video");
//       console.log(
//         "🎥 Watermarked video path received from applyWatermark:",
//         watermarkedVideo
//       );

//       const videoUpload = await uploadToCloudinary(
//         watermarkedVideo,
//         "ads/videos"
//       );
//       videoUrl = videoUpload?.secure_url;

//       // Delete temp file
//       if (fs.existsSync(watermarkedVideo)) {
//         console.log("🧼 Deleting watermarked video:", watermarkedVideo);
//         fs.unlinkSync(watermarkedVideo);
//       } else {
//         console.warn("⚠️ Watermarked video not found:", watermarkedVideo);
//       }
//     }

//     // ✅ Fetch pricing
//     const pricing = await AdPricing.findOne().sort({ createdAt: -1 });
//     if (!pricing || typeof pricing.adCommission !== "number") {
//       return res.status(500).json({
//         success: false,
//         message: "Ad commission rate not found in settings.",
//       });
//     }

//     const commissionRate = pricing.adCommission;
//     const totalCost = parseFloat(body.totalCost);
//     const requiredReporter = parseInt(body.requiredReporter);

//     if (!requiredReporter || requiredReporter <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "RequiredReporter must be a valid number greater than 0",
//       });
//     }

//     const adminCommission = (commissionRate / 100) * totalCost;
//     const reporterBudget = totalCost - adminCommission;
//     const finalReporterPrice = parseFloat(
//       (reporterBudget / requiredReporter).toFixed(2)
//     ); // 2 decimal points

//     // ✅ Create ad post
//     const newAd = new Adpost({
//       ...body,
//       imageUrl,
//       videoUrl,
//       owner: req.userId,
//       adminCommission,
//       finalReporterPrice,
//       adCommissionRate: commissionRate,
//     });

//     await newAd.save();

//     // ✅ Coupon logic
//     if (body.couponCode) {
//       const coupon = await Coupon.findOne({
//         code: body.couponCode,
//         status: "active",
//       });

//       if (!coupon) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Invalid or inactive coupon." });
//       }

//       if (new Date(coupon.validUntil) < new Date()) {
//         return res
//           .status(400)
//           .json({ success: false, message: "Coupon has expired." });
//       }

//       if (coupon.usedCount >= coupon.usageLimit) {
//         return res
//           .status(400)
//           .json({
//             success: false,
//             message: "Coupon usage limit has been reached.",
//           });
//       }

//       await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
//     }

//     res.status(201).json({
//       success: true,
//       message: "Ad created",
//       data: newAd,
//     });
//   } catch (error) {
//     console.error("❌ Error in postAdd:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// module.exports = postAdd;









const sendEmail = require("../../utils/sendEmail")
const admins = require("../../models/adminModels/adminRegistration/adminSchema")
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const Adpost = require("../../models/advertismentPost/advertisementPost");
const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");
const Coupon = require("../../models/adminModels/genrateCoupon/createCoupon");
const fs = require("fs");

const postAdd = async (req, res) => {
  try {
    const body = req.body;

    // ✅ Required fields check
    const requiredFields = [
      "adType",
      "requiredViews",
      "mediaType",
      "adLength",
      "startDate",
      // "endDate", // Made optional - removed from required fields
      "subtotal",
      "gst",
      "totalCost",
      "userType",
    ];

    for (const field of requiredFields) {
      const value = body[field];
      if (!value || (typeof value === "string" && value.trim() === "")) {
        return res.status(400).json({
          success: false,
          message: `Field '${field}' is required.`,
        });
      }
    }

    // ✅ Validate userType
    console.log("🔍 Debug - userType received:", body.userType, "Type:", typeof body.userType);
    
    // Handle case where userType might be an array (take first value)
    let userTypeValue = body.userType;
    if (Array.isArray(body.userType)) {
      userTypeValue = body.userType[0];
      console.log("🔍 Debug - userType was array, taking first value:", userTypeValue);
    }
    
    // Normalize userType (trim whitespace and convert to lowercase)
    const normalizedUserType = userTypeValue?.toString()?.trim()?.toLowerCase();
    console.log("🔍 Debug - normalized userType:", normalizedUserType);
    
    if (!["reporter", "influencer"].includes(normalizedUserType)) {
      return res.status(400).json({
        success: false,
        message: "userType must be either 'reporter' or 'influencer'.",
        received: body.userType,
        normalized: normalizedUserType,
        type: typeof body.userType
      });
    }
    
    // Update body.userType with normalized value
    body.userType = normalizedUserType;

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    let imageUrl = "";
    let videoUrl = "";

    if (imageFile) {
      // console.log("📸 Original image:", imageFile.path);

      const imageUpload = await uploadToCloudinary(
        imageFile.path,
        "ads/images"
      );
      imageUrl = imageUpload?.secure_url;
    }

    if (videoFile) {
      // console.log("🎥 Original video:", videoFile.path);

      const videoUpload = await uploadToCloudinary(
        videoFile.path,
        "ads/videos"
      );
      videoUrl = videoUpload?.secure_url;
    }

    // ✅ Fetch pricing
    const pricing = await AdPricing.findOne().sort({ createdAt: -1 });
    if (!pricing || typeof pricing.adCommission !== "number") {
      return res.status(500).json({
        success: false,
        message: "Ad commission rate not found in settings.",
      });
    }

    const commissionRate = pricing.adCommission;
    const totalCost = parseFloat(body.totalCost);
    const requiredViews = parseInt(body.requiredViews);
    const baseView = pricing.baseView || 1000; // Default to 1000 if not set
    
    // ✅ Calculate requiredReporter based on requiredViews and baseView
    const requiredReporter = Math.ceil(requiredViews / baseView);
    
    console.log("📊 View Distribution Calculation:", {
      requiredViews,
      baseView,
      calculatedRequiredReporter: requiredReporter,
      viewsPerReporter: baseView
    });

    if (!requiredReporter || requiredReporter <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid required views or base view configuration",
      });
    }

    const adminCommission = (commissionRate / 100) * totalCost;
    const reporterBudget = totalCost - adminCommission;
    const finalReporterPrice = parseFloat(
      (reporterBudget / requiredReporter).toFixed(2)
    ); // 2 decimal points

    // ✅ Create ad post
    const newAd = new Adpost({
      ...body,
      imageUrl,
      videoUrl,
      owner: req.userId,
      adminCommission,
      finalReporterPrice,
      adCommissionRate: commissionRate,
      baseView: baseView, // ✅ Store baseView for view distribution
      requiredReporter: requiredReporter, // ✅ Store calculated requiredReporter
    });

    await newAd.save();

    // ✅ Coupon logic
    if (body.couponCode) {
      const coupon = await Coupon.findOne({
        code: body.couponCode,
        status: "active",
      });

      if (!coupon) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or inactive coupon." });
      }

      if (new Date(coupon.validUntil) < new Date()) {
        return res
          .status(400)
          .json({ success: false, message: "Coupon has expired." });
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Coupon usage limit has been reached.",
          });
      }

      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
    }

      // ✅ Send Notification Emails to Superadmin & Subadmins
    const superAdmins = await admins.find({ role: "superadmin" });
    const subAdmins = await admins.find({
      role: "subadmin",
      assignedSections: "advertisment",
    });

    // console.log("these are my admin who get the notification after new ad submited",superAdmins,subAdmins)

    const recipients = [
      ...superAdmins.map((a) => a.email),
      ...subAdmins.map((a) => a.email),
    ];

    for (const email of recipients) {
      await sendEmail(
        email,
        "📢 New Ad Submitted",
        `A new ad has been created by user ${req.userId}. Ad Type: ${newAd.adType}`,
        `<h2>📢 New Ad Submitted</h2>
         <p><strong>Advertiser:</strong> ${req.userId}</p>
         <p><strong>Ad Type:</strong> ${newAd.adType}</p>
         <p><strong>Required Views:</strong> ${newAd.requiredViews}</p>
         <p><strong>Start Date:</strong> ${newAd.startDate}</p>
         <p><strong>End Date:</strong> ${newAd.endDate || 'Not specified'}</p>`
      );
    }




    res.status(201).json({
      success: true,
      message: "Ad created successfully with view distribution calculated",
      data: {
        ...newAd.toObject(),
        viewDistribution: {
          totalRequiredViews: requiredViews,
          baseViewPerReporter: baseView,
          totalReportersNeeded: requiredReporter,
          viewsPerReporter: baseView
        }
      },
    });
  } catch (error) {
    console.error("❌ Error in postAdd:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = postAdd;

