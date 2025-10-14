const mongoose = require("mongoose");

const paidConferenceSchema = new mongoose.Schema(
  {
    // User who submitted the conference
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PressConferenceUser",
      required: true,
    },
    
    // Conference details
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    conferenceDate: {
      type: String,
      required: true,
    },
    conferenceTime: {
      type: String,
      required: true,
    },
    timePeriod: {
      type: String,
      enum: ["AM", "PM"],
      required: true,
    },
    
    // Location details
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    place: {
      type: String,
      required: true,
      trim: true,
    },
    landmark: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Additional information
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
    numberOfReporters: {
      type: Number,
      default: 0,
      min: 0,
      max: 50,
    },
    
    // Payment details
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentAmount: {
      type: Number,
      default: 0,
    },
    paymentId: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "wallet"],
      default: "razorpay",
    },
    
    // Status and approval
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "modified", "running", "completed"],
      default: "pending",
    },
    
    // Admin actions
    adminAction: {
      action: {
        type: String,
        enum: ["approved", "rejected", "modified"],
      },
      note: {
        type: String,
        trim: true,
      },
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      actionDate: {
        type: Date,
      },
    },
    
    // Modified states (for when admin modifies conference)
    modifiedStates: [{
      type: String,
    }],
    adminSelectState: [{
      type: String,
    }],
    adminSelectCities: [{
      type: String,
    }],
    adminSelectPincode: {
      type: String,
      trim: true,
    },
    reporterId: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reporter",
    }],
    excludedReporters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reporter",
    }],
    allStates: {
      type: Boolean,
      default: false,
    },
    
    // Commission details (for approved/modified conferences)
    commissionDetails: {
      commissionPercentage: {
        type: Number,
        default: 0
      },
      commissionAmount: {
        type: Number,
        default: 0
      },
      amountAfterCommission: {
        type: Number,
        default: 0
      },
      amountPerReporter: {
        type: Number,
        default: 0
      },
      calculatedAt: {
        type: Date
      }
    },
    
    // Refund details (for rejected conferences and incomplete conferences)
    refundDetails: {
      refundAmount: {
        type: Number,
        default: 0
      },
      refundedAt: {
        type: Date
      },
      refundReason: {
        type: String,
        trim: true
      },
      refundTransactionId: {
        type: String,
        trim: true
      },
      shortfallReporters: {
        type: Number,
        default: 0
      },
      rejectionNote: {
        type: String,
        trim: true
      }
    },
    
    // Reporter interactions
    acceptedReporters: [{
      reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reporterName: String,
      reporterEmail: String,
      acceptedAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["accepted", "completed"],
        default: "accepted",
      },
      proofSubmitted: {
        type: Boolean,
        default: false,
      },
      proof: {
        screenshot: String,
        channelName: String,
        videoLink: String,
        platform: String,
        duration: String,
        submittedAt: Date,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        adminNote: String,
        approvedAt: Date,
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },
        rejectedAt: Date,
        rejectedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },
      },
    }],
    
    rejectedReporters: [{
      reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reporterName: String,
      reporterEmail: String,
      rejectedAt: {
        type: Date,
        default: Date.now,
      },
      rejectNote: String,
      status: {
        type: String,
        default: "rejected",
      },
    }],
    
    // Conference ID for tracking
    conferenceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Completion details
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    
    // Modification tracking
    modifiedAt: {
      type: Date,
    },
    
    // Timestamps
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Generate conference ID before saving
paidConferenceSchema.pre("save", async function (next) {
  if (!this.conferenceId) {
    let uniqueId;
    let exists = true;
    let counter = 0;

    while (exists) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      uniqueId = `PAID${randomNum}`;
      
      const existingConference = await this.constructor.findOne({ conferenceId: uniqueId });
      if (!existingConference) {
        exists = false;
      }
      
      counter++;
      if (counter > 20) {
        throw new Error("Unable to generate unique conference ID");
      }
    }
    
    this.conferenceId = uniqueId;
  }
  next();
});

const PaidConference = mongoose.model("PaidConference", paidConferenceSchema);

module.exports = PaidConference;
