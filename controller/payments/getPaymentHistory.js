const PaymentHistory  = require('../../models/paymentHistory/paymentHistory')

const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("userid", userId);

    const history = await PaymentHistory.find({ user: userId })
      .populate('ad') // get ad details
      .populate('user', 'iinsafId name email') // get only iinsafId (and optionally name/email)
      .sort({ date: -1 });

    res.status(200).json(history);
    // console.log("this is history", history);
  } catch (error) {
    console.error("Payment history fetch error:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
};


module.exports = getPaymentHistory