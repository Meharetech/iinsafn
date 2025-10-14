const mongoose = require("mongoose");

const adPricingSchema = new mongoose.Schema({
  adType: [
    {
      id: Number,
      name: String,
      price: Number
    }
  ],
  channelType: [
    {
      id: Number,
      name: String
    }
  ],
  plateforms: [ String],
  gstRate: Number,
  perDayPrice: Number,
  perSecPrice: Number,
  perCityPrice: Number,
  baseView: Number,
  adCommission: Number,
  fbVideoUploadLink: String,
  reporterAcceptTimeInHours: {
    type: Number, // stores time in hours
    default: 0
  },
  minimumWithdrawAmountForReporter: {  // ✅ new field
    type: Number,
    default: 0
  },
  reporterPrice: {  // ✅ new field for paid conferences
    type: Number,
    default: 0
  },
  paidConferenceCommission: {  // ✅ new field for paid conference commission percentage
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("AdPricing", adPricingSchema);
