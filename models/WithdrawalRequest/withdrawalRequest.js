const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  amount: { type: Number, required: true },
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String // optional
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
