const mongoose = require("mongoose");

const advertisementSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channelType: {
      type: [String],
      required: true,
    },
    platforms: {
      type: [String],
      default: [],
    },
    adPreference: {
      type: [String],
    },
    adType: {
      type: String,
      required: true,
    },
    requiredViews: {
      type: String,
      required: true,
    },
    requiredReporter: Number,
    pfState: {
      type: String,
    },
    pfCities: {
      type: [String],
      default: [],
    },
    adState: {
      type: String,
      required: false,
    },
    adCity: {
      type: String,
      required: false,
    },
    pincode: {
      type: Number,
      required: false,
    },
    couponCode: {
      type: String,
    },
    mediaType: {
      type: String,
      required: true,
    },
    mediaDescription: {
      type: String,
      required: true,
    },
    adLength: {
      type: String,
      required: true,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: false, // Made optional - end date is no longer required
    },
    subtotal: {
      type: String,
      required: true,
    },
    gst: {
      type: String,
      required: true,
    },
    totalCost: {
      type: String,
      required: true,
    },
    adminCommission: Number,
    finalReporterPrice: Number,
    adCommissionRate: Number,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "running", "completed", "modified"],
      default: "pending",
    },
    userType: {
      type: String,
      enum: ["reporter", "influencer"],
      default: "reporter",
    },
    adminRejectNote: {
      type: String,
      default: "",
    },

    imageUrl: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    // Admin-only fields
    adminSelectState: [
      {
        type: String,
      },
    ],
    adminSelectCities: [
      {
        type: String,
      },
    ],
    adminSelectPincode: {
      type: Number,
    },
    reporterId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    allStates: {
      type: Boolean,
      default: false,
    },
    baseView: Number,
    acceptReporterCount: {
      type: Number,
      default: 0,
    },
    approvedAt: {
      type: Date,
    },
    acceptBefore: {
      type: Date,
    },
    acceptRejectReporterList: [
      {
        reporterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        iinsafId: {
          type: String,
          required: true,
        },
        postStatus: {
          type: String,
          enum: ["pending", "accepted", "submitted", "completed", "rejected", "proof_submitted", "proof_rejected"],
          default: "pending",
        },
        accepted: {
          type: Boolean,
          default: false,
        },
        adProof: {
          type: Boolean,
          default: false,
        },
        rejectNote: {
          type: String,
          default: "",
        },
        adminRejectedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
          default: null
        },
        adminRejectedByName: {
          type: String,
          default: ""
        },
        rejectedAt: {
          type: Date,
        },
        acceptedAt: {
          type: Date,
        },
        submittedAt: {
          type: Date,
        },
        completedAt: {
          type: Date,
        },
        userRole: {
          type: String,
          enum: ["Reporter", "Influencer"],
        },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Pre-save hook to clean up invalid postStatus values
advertisementSchema.pre("save", function (next) {
  if (this.acceptRejectReporterList && Array.isArray(this.acceptRejectReporterList)) {
    const validStatuses = ["pending", "accepted", "submitted", "completed", "rejected", "proof_submitted", "proof_rejected"];
    let fixedCount = 0;

    this.acceptRejectReporterList.forEach((entry) => {
      if (entry.postStatus && !validStatuses.includes(entry.postStatus)) {
        console.log(`⚠️ Auto-fixing invalid postStatus "${entry.postStatus}" - replacing with "accepted"`);
        entry.postStatus = "accepted";
        fixedCount++;
      }
    });

    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} invalid postStatus value(s) in acceptRejectReporterList`);
    }
  }
  next();
});

const Adpost = mongoose.model("Adpost", advertisementSchema);
module.exports = Adpost;
