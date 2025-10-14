// const mongoose = require("mongoose");

// const walletSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   userType: { type: String, enum: ["Advertiser", "Reporter", "PressConferenceUser"], required: true },
//   balance: { type: Number, default: 0 },
//   transactions: [
//     {
//       type: { type: String, enum: ["credit", "debit"], required: true },
//       amount: Number,
//       paymentId: { type: String },
//       refundId: { type: String },
//       description: String,
//       date: { type: Date, default: Date.now },
//       status: { type: String, enum: ["success", "pending", "failed"], default: "success" }
//     }
//   ]
// });

// module.exports = mongoose.model("Wallet", walletSchema);




const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ["Advertiser", "Reporter", "PressConferenceUser", "Influencer"], required: true },
  balance: { type: Number, default: 0 },
  transactions: [
    {
      type: { type: String, enum: ["credit", "debit"], required: true },
      amount: Number,
      paymentId: { type: String },
      refundId: { type: String },
      description: String,
      date: { type: Date, default: Date.now },
      status: { 
        type: String, 
        enum: ["success", "pending", "failed"], 
        default: "success" 
      },

      // ✅ New fields for withdrawal transactions
      bankDetails: {
        accountHolder: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        upiId: String
      },

      withdrawalRequestId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "WithdrawalRequest" 
      }
    }
  ]
});

module.exports = mongoose.model("Wallet", walletSchema);
