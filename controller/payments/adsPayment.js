require("dotenv").config();
const Razorpay = require("razorpay");
const paymentHistory = require("../../models/paymentHistory/paymentHistory");
const User = require("../../models/userModel/userModel");
const Wallet = require("../../models/Wallet/walletSchema");
const mongoose = require("mongoose");



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Generate a random receipt ID (for better uniqueness)
const generateReceiptId = () => {
  return "receipt_" + Math.floor(Math.random() * 1000000);
};

const adsPayment = async (req, res) => {
  const { amount, currency } = req.body;
  if (!amount || !currency) {
    return res.status(400).json({ error: "Amount and currency are required" });
  }

  const options = {
    amount,
    currency,
    receipt: generateReceiptId(),
    payment_capture: 1, // automatic capture after success
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json({
      order_id: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res
      .status(500)
      .json({ error: "Internal server error during order creation" });
  }
};

const successOrNot = async (req, res) => {
  const { paymentId } = req.params;
  // console.log("payment id payment with id success or not",paymentId)
  const userId = req.user._id;
  // console.log("this the user id",userId);

  if (!paymentId) {
    return res.status(400).json({ error: "Payment ID is required" });
  }

  try {
    const payment = await razorpay.payments.fetch(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Only save successful payments
    if (payment.status === "captured") {
      const newHistory = new paymentHistory({
        user: userId,
        paymentId: paymentId,
        amount: payment.amount / 100, // Razorpay returns in paise
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        totalCost: payment.amount / 100,
        gst: (payment.amount / 100) * 0.18, // if 18% GST
      });

      await newHistory.save();
    }

    res.status(200).json({
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
    });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({ error: "Failed to fetch payment status" });
  }
};

// helper to generate unique paymentId for wallet payments
const generatePaymentId = () => {
  const prefix = "PAY";
  const uniquePart =
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  return `${prefix}-${uniquePart.toUpperCase()}`;
};


const payFromWallet = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { amount } = req.body;
    const userId = req.user._id;
    const userType = req.user.role;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    let wallet = await Wallet.findOne({ userId, userType });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // generate paymentId
    const paymentId = generatePaymentId();
    const gstRate = 0.18;
    const gstAmount = amount * gstRate;

    // transaction-supported flag
    const supportsTransactions = mongoose.connection.client.s.options.replicaSet;

    if (supportsTransactions) {
      // ✅ Use transaction if replica set
      await session.withTransaction(async () => {
        wallet.balance -= amount;
        wallet.transactions.push({
          type: "debit",
          amount,
          description: "Wallet payment for advertisement",
          status: "success",
          paymentId,
        });
        await wallet.save({ session });

        const newHistory = new paymentHistory({
          user: userId,
          paymentId,
          amount,
          currency: "INR",
          method: "wallet",
          status: "success",
          totalCost: amount,
          gst: gstAmount,
        });
        await newHistory.save({ session });
      });
    } else {
      // ⚠️ Fallback: manual rollback
      wallet.balance -= amount;
      wallet.transactions.push({
        type: "debit",
        amount,
        description: "Wallet payment for advertisement",
        status: "success",
        paymentId,
      });
      await wallet.save();

      try {
        const newHistory = new paymentHistory({
          user: userId,
          paymentId,
          amount,
          currency: "INR",
          method: "wallet",
          status: "success",
          totalCost: amount,
          gst: gstAmount,
        });
        await newHistory.save();
      } catch (historyErr) {
        // rollback wallet if history fails
        wallet.balance += amount;
        wallet.transactions = wallet.transactions.filter(
          (tx) => tx.paymentId !== paymentId
        );
        await wallet.save();
        throw historyErr;
      }
    }

    res.status(200).json({
      success: true,
      message: "Wallet payment successful",
      paymentId,
      newBalance: wallet.balance,
    });
  } catch (err) {
    console.error("🔥 Wallet payment error:", err);
    res.status(500).json({ success: false, message: "Wallet payment failed" });
  } finally {
    session.endSession();
  }
};



// Wallet top-up functionality
const walletTopUp = async (req, res) => {
  const { amount, currency } = req.body;
  const userId = req.user._id;

  if (!amount || !currency) return res.status(400).json({ error: "Amount and currency are required" });

  const options = {
    amount: amount * 100, // ✅ convert rupees → paise
    currency,
    receipt: generateReceiptId(),
    payment_capture: 1,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json({ order_id: order.id, currency: order.currency, amount: order.amount });
  } catch (error) {
    console.error("Error creating wallet order:", error);
    res.status(500).json({ error: "Failed to create wallet order" });
  }
};


const walletPaymentSuccess = async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user._id;
  const userType = req.user.role; // ✅ from JWT / session

  if (!paymentId) return res.status(400).json({ error: "Payment ID is required" });

  try {
    const payment = await razorpay.payments.fetch(paymentId);

    if (!payment || payment.status !== "captured") {
      return res.status(400).json({ error: "Payment not successful" });
    }

    const amountInRupees = payment.amount / 100;

    // Save wallet payment history
    const newHistory = new paymentHistory({
      user: userId,
      paymentId: payment.id,
      amount: amountInRupees,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      totalCost: amountInRupees,
      gst: amountInRupees * 0.18,
      type: "Wallet Top-Up",
    });
    await newHistory.save();

    // Update wallet
    let wallet = await Wallet.findOne({ userId, userType });
    if (!wallet) {
      wallet = new Wallet({
        userId,
        userType,
        balance: 0,
        transactions: [],
      });
    }

    // Add credit transaction
    wallet.transactions.push({
      type: "credit",
      amount: amountInRupees,
      description: "Wallet top-up via Razorpay",
      status: "success",
      date: new Date(),
      paymentId: payment.id,
    });

    wallet.balance += amountInRupees;
    await wallet.save();

    res.status(200).json({
      success: true,
      message: "Wallet topped up successfully",
      balance: wallet.balance,
      status: payment.status, // ✅ so frontend can check
      payment: {
        paymentId: payment.id,
        amount: amountInRupees,
        method: payment.method,
        currency: payment.currency,
      },
    });
  } catch (error) {
    console.error("Error processing wallet payment:", error);
    res.status(500).json({ error: "Failed to process wallet payment" });
  }
};


module.exports = { adsPayment, successOrNot, payFromWallet, walletTopUp, walletPaymentSuccess};
