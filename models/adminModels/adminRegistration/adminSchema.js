const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    mobileNumber: {
      type: Number,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "subadmin"],
      default: "subadmin",
    },
    assignedSections: [
      {
        type: String,
      },
    ],
   accessPaths: [String],  
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
