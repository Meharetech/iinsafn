
const Wallet = require("../../models/Wallet/walletSchema");
const WithdrawalRequest = require("../../models/WithdrawalRequest/withdrawalRequest");
const admins = require("../../models/adminModels/adminRegistration/adminSchema"); // Assuming super admin stored in User model
const sendEmail = require("../../utils/sendEmail");
const notifyOnWhatsapp = require("../../utils/notifyOnWhatsapp");
const Templates = require("../../utils/whatsappTemplates");
const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema")




const reporterWithdrawal = async (req, res) => {
  const userId = req.user._id;
  const userType = req.user.role;
  const { amount, accountHolder, accountNumber, ifscCode, bankName, upiId } = req.body;

  console.log("🔍 Withdrawal Debug - User ID:", userId);
  console.log("🔍 Withdrawal Debug - User Type:", userType);

  if (!amount || amount <= 0) {
    return res.status(400).json({ status: "invalid_amount", message: "Invalid withdrawal amount" });
  }

  try {
    // ✅ 1. Fetch minimum withdraw amount set by Admin from adPricing
    const adPricing = await AdPricing.findOne();
    const minWithdrawAmount = adPricing?.minimumWithdrawAmountForReporter || 0; // if not set → default 0

    if (amount < minWithdrawAmount) {
      return res.status(400).json({
        status: "below_minimum",
        message: `Minimum withdrawal amount is ${minWithdrawAmount}`
      });
    }

    // ✅ 2. Check wallet balance - Updated to work for both Reporter and Influencer
    const wallet = await Wallet.findOne({ userId: userId, userType: userType });
    if (!wallet) {
      return res.status(404).json({ status: "wallet_not_found", message: "Wallet not found" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        status: "insufficient_balance",
        message: "Withdrawal amount exceeds available wallet balance"
      });
    }

    // ✅ 3. Create withdrawal request
    const withdrawal = new WithdrawalRequest({
      reporterId: userId, // Keep the field name as reporterId for backward compatibility
      amount,
      bankDetails: {
        accountHolder,
        accountNumber,
        ifscCode,
        bankName,
        upiId
      }
    });
    await withdrawal.save();

    // ✅ 4. Deduct balance
    wallet.balance -= amount;

    // ✅ 5. Push transaction
    const transaction = {
      type: "debit",
      amount,
      description: "Withdrawal requested",
      status: "pending",
      withdrawalRequestId: withdrawal._id,
      bankDetails: {
        accountHolder,
        accountNumber,
        ifscCode,
        bankName,
        upiId
      }
    };
    wallet.transactions.push(transaction);
    await wallet.save();

    // ✅ 6. Link transaction back to withdrawal
    const lastTransaction = wallet.transactions[wallet.transactions.length - 1];
    withdrawal.transactionId = lastTransaction._id;
    await withdrawal.save();

    // ✅ 7. Notify all Super Admins (Email + WhatsApp)
    const superAdmins = await admins.find({ role: "SuperAdmin" });

    for (const admin of superAdmins) {
      // 📧 Email notification
      await sendEmail(
        admin.email,
        "New Withdrawal Request",
        `
        <h2>New Withdrawal Request Submitted</h2>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>User Type:</strong> ${userType}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Bank Details:</strong> ${JSON.stringify({
          accountHolder,
          accountNumber,
          ifscCode,
          bankName,
          upiId
        })}</p>
        <p>Please review and process this request from the admin dashboard.</p>
        `
      );

      // 📱 WhatsApp notification
      if (admin.mobileNumber) {
        await notifyOnWhatsapp(
          admin.mobileNumber,
          Templates.NOTIFY_TO_ADMIN_WHEN_GET_NEW_WITHDRAWAL_REQUEST, // AiSensy template
          [
            admin.name,           // {{1}} -> Admin name
            `${userId} (${userType})`, // {{2}} -> User ID and Type
            String(amount),       // {{3}} -> Withdrawal amount
            `${accountHolder}, ${accountNumber}, ${ifscCode}, ${bankName}, ${upiId}` // {{4}} -> Bank details
          ]
        );
      }
    }

    res.status(200).json({
      success: true,
      status: "request_submitted",
      message: "Withdrawal request submitted successfully",
      withdrawalId: withdrawal._id,
      transactionId: lastTransaction._id
    });
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ status: "server_error", message: "Internal server error" });
  }
};





module.exports = reporterWithdrawal;
