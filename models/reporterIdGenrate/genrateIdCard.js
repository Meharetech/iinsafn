const mongoose = require("mongoose");

const genrateIdCardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
    },
    aadharNo: {
      type: Number,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: String,
      required: true,
    },
    bloodGroup: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    image: {
      type: String, // Reporter profile photo
      required: true,
    },
    channelLogo: {
      type: String, // Channel logo image
      required: true,
    },
    channelName: {
      type: String,
      required: true,
    },
    channelType: {
      type: String,
      required: true,
    },
    plateform: {
      type: String,
      required: true,
    },
    mobileNo: {
      type: Number,
      required: true,
    },
    ResidentialAddress: {
      type: String,
      required: true,
    },
    channelLinks: [
      {
        platform: {
          type: String,
          required: true,
          trim: true,
        },
        link: {
          type: String,
          required: true,
          trim: true,
          match: [/^https?:\/\/.+/, "Please enter a valid URL"],
        },
      },
    ],

    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      default: "Under Review",
      enum: ["Under Review", "Approved", "Rejected"],
    },
    issuedDate: {
      type: String,
    },
    validUpto: {
      type: String,
    },
    rejectNote: {
      type: String,
      default: "",
    },
    iinsafId:{
      type: String,
      default: null
    },
     rejectedAt: { 
      type: Date, index: { expires: '24h' } 
    } // TTL index: auto-delete after 24 hours
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("genrateIdCard", genrateIdCardSchema);
