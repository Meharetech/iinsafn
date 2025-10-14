const mongoose = require("mongoose");

const freeConferenceSchema = new mongoose.Schema(
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
    
    // Status and approval
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "modified", "completed"],
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
    
    // Conference ID for tracking
    conferenceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Completion tracking
    completedAt: {
      type: Date,
    },
    
    // Rejection tracking
    rejectReason: {
      type: String,
      trim: true,
    },
    rejectedAt: {
      type: Date,
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
freeConferenceSchema.pre("save", async function (next) {
  if (!this.conferenceId) {
    let uniqueId;
    let exists = true;
    let counter = 0;

    while (exists) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      uniqueId = `FREE${randomNum}`;
      
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

const FreeConference = mongoose.model("FreeConference", freeConferenceSchema);

module.exports = FreeConference;
