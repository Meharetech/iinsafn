const PaidConference = require("../../models/pressConference/paidConference");
const AdPricing = require("../../models/adminModels/advertismentPriceSet/adPricingSchema");
const paymentHistory = require("../../models/paymentHistory/paymentHistory");
const Razorpay = require("razorpay");
const Wallet = require("../../models/Wallet/walletSchema");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");
const User = require("../../models/userModel/userModel");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Generate a random receipt ID
const generateReceiptId = () => {
  return "receipt_" + Math.floor(Math.random() * 1000000);
};

// Calculate pricing for paid conference
const calculatePaidConferencePrice = async (req, res) => {
  try {
    const { numberOfReporters } = req.body;
    console.log("Calculating pricing for reporters:", numberOfReporters);

    if (numberOfReporters === undefined || numberOfReporters === null || numberOfReporters < 0) {
      console.log("Invalid number of reporters:", numberOfReporters);
      return res.status(400).json({
        success: false,
        message: "Number of reporters is required and must be non-negative"
      });
    }

    // Get pricing data
    const pricing = await AdPricing.findOne();
    console.log("Pricing data from database:", pricing);
    
    if (!pricing) {
      console.log("No pricing configuration found");
      return res.status(404).json({
        success: false,
        message: "Pricing configuration not found"
      });
    }

    const reporterPrice = pricing.reporterPrice || 0;
    const gstRate = pricing.gstRate || 18;
    console.log("Reporter price:", reporterPrice, "GST rate:", gstRate);
    console.log("Full pricing object:", JSON.stringify(pricing, null, 2));

    // Calculate pricing
    const subtotal = numberOfReporters * reporterPrice;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;

    const pricingData = {
      numberOfReporters,
      reporterPrice,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount
    };

    console.log("Calculated pricing:", pricingData);

    res.status(200).json({
      success: true,
      data: pricingData
    });
  } catch (error) {
    console.error("Error calculating paid conference price:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Create paid conference order
const createPaidConferenceOrder = async (req, res) => {
  try {
    const { numberOfReporters } = req.body;
    const userId = req.user._id;

    if (!numberOfReporters || numberOfReporters < 0) {
      return res.status(400).json({
        success: false,
        message: "Number of reporters is required and must be non-negative"
      });
    }

    // Get pricing data
    const pricing = await AdPricing.findOne();
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing configuration not found"
      });
    }

    const reporterPrice = pricing.reporterPrice || 0;
    const gstRate = pricing.gstRate || 18;

    // Calculate pricing
    const subtotal = numberOfReporters * reporterPrice;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;

    // Create Razorpay order
    const options = {
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: "INR",
      receipt: generateReceiptId(),
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        currency: order.currency,
        amount: order.amount,
        pricing: {
          numberOfReporters,
          reporterPrice,
          subtotal,
          gstRate,
          gstAmount,
          totalAmount
        }
      }
    });
  } catch (error) {
    console.error("Error creating paid conference order:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during order creation"
    });
  }
};

// Submit paid conference
const submitPaidConference = async (req, res) => {
  try {
    const {
      topic,
      purpose,
      conferenceDate,
      conferenceTime,
      timePeriod,
      state,
      city,
      place,
      landmark,
      adminNote,
      numberOfReporters,
      paymentId,
      orderId,
      paymentMethod,
      paymentAmount,
      paymentStatus
    } = req.body;

    const userId = req.user._id;
    console.log("Submitting paid conference for user:", userId);
    console.log("Conference data:", req.body);

    // Validate required fields
    const requiredFields = [
      'topic', 'purpose', 'conferenceDate', 'conferenceTime', 
      'timePeriod', 'state', 'city', 'place', 'landmark'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.log("Missing required fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate purpose length (minimum 10 words)
    const wordCount = purpose.trim().split(/\s+/).filter(word => word.length > 0).length;
    console.log("Purpose word count:", wordCount);
    console.log("Purpose text:", purpose);
    
    if (wordCount < 10) {
      console.log("Purpose validation failed - too few words:", wordCount);
      return res.status(400).json({
        success: false,
        message: "Purpose must be at least 10 words"
      });
    }

    // Validate minimum 1 reporter for paid conferences
    const reporterCount = parseInt(numberOfReporters) || 0;
    console.log("Number of reporters:", reporterCount);
    
    if (reporterCount < 1) {
      console.log("Reporter validation failed - minimum 1 required:", reporterCount);
      return res.status(400).json({
        success: false,
        message: "At least 1 reporter is required for paid conferences"
      });
    }

    // Get pricing data
    const pricing = await AdPricing.findOne();
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing configuration not found"
      });
    }

    const reporterPrice = pricing.reporterPrice || 0;
    const gstRate = pricing.gstRate || 18;

    // Calculate pricing
    const subtotal = numberOfReporters * reporterPrice;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;

    // Handle wallet payment
    let walletPaymentId = null;
    if (paymentMethod === "wallet") {
      console.log("Processing wallet payment for amount:", totalAmount);
      
      // Generate payment ID for wallet payment
      walletPaymentId = `WALLET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Find or create wallet for the user
      let wallet = await Wallet.findOne({ 
        userId: userId, 
        userType: "PressConferenceUser" 
      });
      
      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          userType: "PressConferenceUser",
          balance: 0,
          transactions: []
        });
        await wallet.save();
        console.log("Created new wallet for user:", userId);
      }

      // Check if user has sufficient balance
      if (wallet.balance < totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance"
        });
      }

      // Deduct amount from wallet
      const previousBalance = wallet.balance;
      wallet.balance = Number(previousBalance) - Number(totalAmount);
      
      const walletTransaction = {
        type: "debit",
        amount: totalAmount,
        description: `Payment for paid conference: ${topic}`,
        status: "success",
        date: new Date(),
        paymentId: walletPaymentId,
        conferenceId: `PAID${Date.now()}`
      };
      
      wallet.transactions.push(walletTransaction);
      await wallet.save();
      
      console.log(`Wallet payment processed: ₹${totalAmount} deducted from wallet. Payment ID: ${walletPaymentId}. New balance: ₹${wallet.balance}`);
    }

    // Create paid conference
    const paidConference = new PaidConference({
      submittedBy: userId,
      topic,
      purpose,
      conferenceDate,
      conferenceTime,
      timePeriod,
      state,
      city,
      place,
      landmark,
      adminNote: adminNote || "",
      numberOfReporters: numberOfReporters || 0,
      paymentStatus: paymentMethod === "wallet" ? "paid" : (paymentId ? "paid" : "pending"),
      paymentAmount: totalAmount,
      paymentId: paymentMethod === "wallet" ? walletPaymentId : (paymentId || ""),
      paymentMethod: paymentMethod || "razorpay",
      status: "pending"
    });

    await paidConference.save();

    // If payment was successful, save payment history
    if (paymentId || walletPaymentId) {
      const newHistory = new paymentHistory({
        user: userId,
        paymentId: paymentMethod === "wallet" ? walletPaymentId : paymentId,
        amount: totalAmount,
        currency: "INR",
        method: paymentMethod === "wallet" ? "wallet" : "razorpay",
        status: paymentMethod === "wallet" ? "paid" : "captured",
        totalCost: totalAmount,
        gst: gstAmount,
      });

      await newHistory.save();
    }

    res.status(201).json({
      success: true,
      message: "Paid conference submitted successfully",
      data: {
        conferenceId: paidConference.conferenceId,
        paymentStatus: paidConference.paymentStatus,
        totalAmount
      }
    });
  } catch (error) {
    console.error("Error submitting paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get user's paid conferences
const getUserPaidConferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const conferences = await PaidConference.find({ submittedBy: userId })
      .populate('acceptedReporters.reporterId', 'name email iinsafId city state')
      .sort({ createdAt: -1 });

    // Process conferences to include reporter details
    const processedConferences = conferences.map(conference => {
      const conferenceObj = conference.toObject();
      
      // Process accepted reporters to include full details
      if (conferenceObj.acceptedReporters && conferenceObj.acceptedReporters.length > 0) {
        conferenceObj.acceptedReporters = conferenceObj.acceptedReporters.map(reporter => {
          const reporterData = reporter.reporterId || {};
          return {
            ...reporter,
            reporterName: reporter.reporterName || reporterData.name || 'N/A',
            reporterEmail: reporter.reporterEmail || reporterData.email || 'N/A',
            iinsafId: reporterData.iinsafId || 'N/A',
            reporterCity: reporterData.city || 'N/A',
            reporterState: reporterData.state || 'N/A',
            proofSubmitted: reporter.proofSubmitted || false,
            proofDetails: reporter.proof || null
          };
        });
      }

      // Calculate totals for statistics
      conferenceObj.totalAcceptedReporters = conferenceObj.acceptedReporters?.length || 0;
      conferenceObj.totalProofSubmitted = conferenceObj.acceptedReporters?.filter(r => r.proofSubmitted).length || 0;
      conferenceObj.totalProofPending = conferenceObj.totalAcceptedReporters - conferenceObj.totalProofSubmitted;

      return conferenceObj;
    });

    console.log("Processed user paid conferences:", processedConferences.length);

    res.status(200).json({
      success: true,
      data: processedConferences
    });
  } catch (error) {
    console.error("Error fetching user paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get all paid conferences (admin)
const getAllPaidConferences = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }

    const conferences = await PaidConference.find(query)
      .populate('submittedBy', 'name email')
      .populate('acceptedReporters.reporterId', 'name email iinsafId city state')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PaidConference.countDocuments(query);

    // Process conferences to add proof statistics and completed reporters
    const processedConferences = conferences.map(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      const totalAccepted = acceptedReporters.length;
      const totalProofSubmitted = acceptedReporters.filter(reporter => reporter.proofSubmitted).length;
      const totalProofPending = totalAccepted - totalProofSubmitted;

      // For completed conferences, create completedReporters array
      let completedReporters = [];
      if (conference.status === "completed") {
        completedReporters = acceptedReporters
          .filter(reporter => reporter.proofSubmitted && reporter.proof?.status === 'approved')
          .map(reporter => ({
            reporterId: reporter.reporterId,
            reporterName: reporter.reporterName,
            reporterEmail: reporter.reporterEmail,
            iinsafId: reporter.reporterId?.iinsafId || "N/A",
            reporterCity: reporter.reporterId?.city || "N/A",
            reporterState: reporter.reporterId?.state || "N/A",
            status: "completed",
            acceptedAt: reporter.acceptedAt,
            completedAt: reporter.proof?.submittedAt || reporter.acceptedAt,
            proofSubmitted: reporter.proofSubmitted,
            proof: reporter.proof
          }));
      }

      return {
        ...conference.toObject(),
        totalAccepted,
        totalProofSubmitted,
        totalProofPending,
        completedReporters
      };
    });

    res.status(200).json({
      success: true,
      data: {
        conferences: processedConferences,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error("Error fetching paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get all paid conferences with submitted proofs (for admin running page)
const getPaidConferencesWithProofs = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    
    // Find conferences that are approved, modified, or running AND have submitted proofs (but not completed)
    const conferences = await PaidConference.find({
      status: { $in: ["approved", "modified", "running"] },
      "acceptedReporters.proofSubmitted": true
    })
      .populate('submittedBy', 'name email')
      .populate('acceptedReporters.reporterId', 'name email iinsafId city state')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Count conferences that have at least one non-rejected submitted proof (but not completed)
    const allConferences = await PaidConference.find({
      status: { $in: ["approved", "modified", "running"] },
      "acceptedReporters.proofSubmitted": true
    });
    
    const conferencesWithValidProofs = allConferences.filter(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      return acceptedReporters.some(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected" && reporter.proof?.status !== "approved"
      );
    });
    
    const total = conferencesWithValidProofs.length;

    // Filter conferences to only show those with valid (non-rejected, non-approved) proofs
    const validConferences = conferences.filter(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      return acceptedReporters.some(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected" && reporter.proof?.status !== "approved"
      );
    });

    // Process conferences to add proof statistics
    const processedConferences = validConferences.map(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      const totalAccepted = acceptedReporters.length;
      const totalProofSubmitted = acceptedReporters.filter(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected" && reporter.proof?.status !== "approved"
      ).length;
      const totalProofPending = totalAccepted - totalProofSubmitted;
      
      // Get reporters with submitted proofs (excluding rejected and approved ones)
      const reportersWithProofs = acceptedReporters.filter(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected" && reporter.proof?.status !== "approved"
      );

      return {
        ...conference.toObject(),
        totalAccepted,
        totalProofSubmitted,
        totalProofPending,
        reportersWithProofs: reportersWithProofs.map(reporter => ({
          reporterId: reporter.reporterId,
          reporterName: reporter.reporterName,
          reporterEmail: reporter.reporterEmail,
          iinsafId: reporter.reporterId?.iinsafId || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          acceptedAt: reporter.acceptedAt,
          proofSubmitted: reporter.proofSubmitted,
          proof: reporter.proof,
          proofStatus: reporter.proof?.status || "pending"
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: {
        conferences: processedConferences,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        totalConferences: total,
        totalProofs: processedConferences.reduce((sum, conf) => sum + conf.totalProofSubmitted, 0)
      }
    });
  } catch (error) {
    console.error("Error fetching paid conferences with proofs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Admin action on paid conference
const adminActionPaidConference = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { 
      action, 
      note, 
      selectedStates, 
      adminSelectCities, 
      adminSelectPincode, 
      reporterId
    } = req.body;
    const adminId = req.user._id;

    if (!conferenceId || !action) {
      return res.status(400).json({
        success: false,
        message: "Conference ID and action are required"
      });
    }

    const validActions = ['approved', 'rejected', 'modified'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action"
      });
    }

    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    // Get pricing configuration for commission calculation
    const pricing = await AdPricing.findOne();
    const commissionPercentage = pricing?.paidConferenceCommission || 0;

    // Handle different actions
    if (action === "approved") {
      // Calculate commission and distribute to reporters
      await handleApprovalWithCommission(conference, commissionPercentage);
      
      // Set targeting configuration for initial approval
      if (selectedStates && selectedStates.length > 0) {
        conference.adminSelectState = selectedStates;
        console.log(`Conference ${conferenceId} approved with selected states:`, selectedStates);
      }
      
      if (adminSelectCities && adminSelectCities.length > 0) {
        conference.adminSelectCities = adminSelectCities;
        console.log(`Conference ${conferenceId} approved with selected cities:`, adminSelectCities);
      }
      
      if (reporterId && reporterId.length > 0) {
        conference.reporterId = reporterId;
        console.log(`Conference ${conferenceId} approved with selected reporters:`, reporterId);
      }
      
      // If no specific targeting is provided, use original state/city as default
      if ((!selectedStates || selectedStates.length === 0) && 
          (!adminSelectCities || adminSelectCities.length === 0) && 
          (!reporterId || reporterId.length === 0)) {
        // Use original state and city as default targeting
        conference.adminSelectState = [conference.state];
        conference.adminSelectCities = [conference.city];
        console.log(`Conference ${conferenceId} approved with default targeting - state: ${conference.state}, city: ${conference.city}`);
        
        // Find and save the actual users who will be notified
        const actualTargetedUsers = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          state: conference.state,
          city: conference.city
        }).select("_id");
        
        // Save the actual targeted user IDs
        conference.reporterId = actualTargetedUsers.map(user => user._id);
        console.log(`Conference ${conferenceId} - saved ${actualTargetedUsers.length} actually targeted users:`, actualTargetedUsers.map(u => u._id));
      }
      
    } else if (action === "rejected") {
      // Refund full amount to user's wallet
      await handleRejectionWithRefund(conference, note);
    } else if (action === "modified") {
      // Calculate commission and distribute to reporters (same as approval)
      await handleApprovalWithCommission(conference, commissionPercentage);
      
      // For modification, PRESERVE all existing targeting and ADD new targeting
      console.log(`🔄 MODIFYING Conference ${conferenceId} - preserving all existing data`);
      
      // Handle states - combine existing with new
      if (selectedStates && selectedStates.length > 0) {
        const existingStates = conference.adminSelectState || [];
        const originalState = conference.state ? [conference.state] : [];
        
        // Combine original state, existing admin states, and new states
        const allStates = [...new Set([...originalState, ...existingStates, ...selectedStates])];
        conference.adminSelectState = allStates;
        conference.modifiedStates = allStates; // Store for backward compatibility
        console.log(`Conference ${conferenceId} modified - combined states:`, {
          original: originalState,
          existing: existingStates,
          new: selectedStates,
          combined: allStates
        });
      }
      
      // Handle cities - combine existing with new
      if (adminSelectCities && adminSelectCities.length > 0) {
        const existingCities = conference.adminSelectCities || [];
        const originalCity = conference.city ? [conference.city] : [];
        
        // Combine original city, existing admin cities, and new cities
        const allCities = [...new Set([...originalCity, ...existingCities, ...adminSelectCities])];
        conference.adminSelectCities = allCities;
        console.log(`Conference ${conferenceId} modified - combined cities:`, {
          original: originalCity,
          existing: existingCities,
          new: adminSelectCities,
          combined: allCities
        });
      }
      
      // Handle pincode - use new if provided
      if (adminSelectPincode) {
        conference.adminSelectPincode = adminSelectPincode;
        console.log(`Conference ${conferenceId} modified with pincode:`, adminSelectPincode);
      }
      
      // Handle reporters - combine existing with new
      if (reporterId && reporterId.length > 0) {
        const existingReporters = conference.reporterId || [];
        
        // Combine existing and new reporter IDs
        const allReporters = [...new Set([...existingReporters.map(id => id.toString()), ...reporterId.map(id => id.toString())])];
        conference.reporterId = allReporters;
        console.log(`Conference ${conferenceId} modified - combined reporters:`, {
          existing: existingReporters,
          new: reporterId,
          combined: allReporters
        });
      }
      
      // Log final targeting configuration
      console.log(`🎯 Final targeting configuration for ${conferenceId}:`, {
        adminSelectState: conference.adminSelectState,
        adminSelectCities: conference.adminSelectCities,
        reporterId: conference.reporterId,
        originalState: conference.state,
        originalCity: conference.city
      });

      // Add modification timestamp for tracking
      conference.modifiedAt = new Date();
      console.log(`Conference ${conferenceId} marked as modified at:`, conference.modifiedAt);
    }

    // Update conference
    conference.status = action;
    conference.adminAction = {
      action,
      note: note || "",
      modifiedBy: adminId,
      actionDate: new Date()
    };

    await conference.save();
    
    console.log(`Conference ${conferenceId} saved with status: ${conference.status}`);
    console.log(`Targeting configuration:`, {
      adminSelectState: conference.adminSelectState,
      adminSelectCities: conference.adminSelectCities,
      adminSelectPincode: conference.adminSelectPincode,
      reporterId: conference.reporterId
    });

    // Clear rejection status for reporters when resending (modified action)
    if (action === "modified") {
      try {
        const ReporterConference = require("../../models/reporterConference/reporterConference");
        
        if (reporterId && reporterId.length > 0) {
          // Clear rejection status for specific selected reporters
          console.log(`🔄 Clearing rejection status for ${reporterId.length} selected reporters`);
          
          const updateResult = await ReporterConference.updateMany(
            {
              conferenceId: conference.conferenceId,
              reporterId: { $in: reporterId },
              status: "rejected"
            },
            {
              $set: {
                status: "pending",
                rejectedAt: null,
                rejectNote: ""
              },
              $unset: {
                rejectedAt: 1,
                rejectNote: 1
              }
            }
          );
          
          console.log(`✅ Cleared rejection status for ${updateResult.modifiedCount} selected reporters`);
        } else {
          // Clear rejection status for all reporters in this conference
          console.log(`🔄 Clearing rejection status for all reporters in conference ${conference.conferenceId}`);
          
          const updateResult = await ReporterConference.updateMany(
            {
              conferenceId: conference.conferenceId,
              status: "rejected"
            },
            {
              $set: {
                status: "pending",
                rejectedAt: null,
                rejectNote: ""
              },
              $unset: {
                rejectedAt: 1,
                rejectNote: 1
              }
            }
          );
          
          console.log(`✅ Cleared rejection status for ${updateResult.modifiedCount} all reporters`);
        }
        
      } catch (clearRejectionError) {
        console.error(`❌ Error clearing rejection status:`, clearRejectionError);
        // Don't fail the request if clearing rejection fails
      }
    }

    res.status(200).json({
      success: true,
      message: `Conference ${action} successfully`,
      data: conference
    });
  } catch (error) {
    console.error("Error updating paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Verify payment for press conference users
const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;
    console.log("Verifying payment for press conference user:", userId);
    console.log("Payment ID:", paymentId);

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    const payment = await razorpay.payments.fetch(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Only save successful "paid" payments, not "captured"
    if (payment.status === "paid") {
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
      console.log("Payment history saved for press conference user (paid status only)");
    } else {
      console.log("Payment not saved to history - status is:", payment.status, "(only 'paid' status is saved)");
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

// Get payment history for press conference user
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("Fetching payment history for user:", userId);

    // Get all paid conferences for this user
    const paidConferences = await PaidConference.find({ submittedBy: userId })
      .select('conferenceId paymentId paymentAmount paymentStatus createdAt')
      .sort({ createdAt: -1 });

    // Get payment history from paymentHistory collection
    const paymentHistoryRecords = await paymentHistory.find({ user: userId })
      .sort({ createdAt: -1 });

    // Combine and format the data
    const allPayments = [];

    // Add paid conference payments (only "paid" status)
    paidConferences.forEach(conference => {
      if (conference.paymentId && conference.paymentAmount > 0 && conference.paymentStatus === 'paid') {
        allPayments.push({
          _id: conference._id,
          paymentId: conference.paymentId,
          conferenceId: conference.conferenceId,
          amount: conference.paymentAmount,
          status: conference.paymentStatus,
          method: 'Razorpay',
          currency: 'INR',
          createdAt: conference.createdAt,
          type: 'paid_conference'
        });
      }
    });

    // Add payment history entries (only "paid" status, not "captured")
    paymentHistoryRecords.forEach(payment => {
      if (payment.status === 'paid') {
        allPayments.push({
          _id: payment._id,
          paymentId: payment.paymentId,
          conferenceId: payment.conferenceId || 'N/A',
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          currency: payment.currency,
          createdAt: payment.createdAt,
          type: 'payment_history'
        });
      }
    });

    // Remove duplicates based on paymentId
    const uniquePayments = [];
    const seenPaymentIds = new Set();
    
    allPayments.forEach(payment => {
      if (!seenPaymentIds.has(payment.paymentId)) {
        seenPaymentIds.add(payment.paymentId);
        uniquePayments.push(payment);
      }
    });

    // Sort by date (newest first)
    uniquePayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("Payment history fetched successfully:", uniquePayments.length, "unique payments (only 'paid' status)");

    res.status(200).json({
      success: true,
      data: uniquePayments,
      total: uniquePayments.length
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Helper function to handle approval with commission calculation and distribution
const handleApprovalWithCommission = async (conference, commissionPercentage) => {
  try {
    const totalAmount = conference.paymentAmount;
    const numberOfReporters = conference.numberOfReporters;
    
    // Calculate commission amount
    const commissionAmount = (totalAmount * commissionPercentage) / 100;
    const amountAfterCommission = totalAmount - commissionAmount;
    
    // Calculate amount per reporter
    const amountPerReporter = numberOfReporters > 0 ? amountAfterCommission / numberOfReporters : 0;
    
    console.log(`Commission Calculation:
      Total Amount: ₹${totalAmount}
      Commission (${commissionPercentage}%): ₹${commissionAmount}
      Amount After Commission: ₹${amountAfterCommission}
      Number of Reporters: ${numberOfReporters}
      Amount Per Reporter: ₹${amountPerReporter}`);
    
    // Store commission details in conference
    conference.commissionDetails = {
      commissionPercentage,
      commissionAmount,
      amountAfterCommission,
      amountPerReporter,
      calculatedAt: new Date()
    };
    
    // Note: Actual distribution to reporters will happen when they accept the conference
    // This just calculates and stores the amounts
    
  } catch (error) {
    console.error("Error in handleApprovalWithCommission:", error);
    throw error;
  }
};

// Helper function to handle rejection with full refund
const handleRejectionWithRefund = async (conference, rejectionNote) => {
  try {
    const refundAmount = conference.paymentAmount;
    const userId = conference.submittedBy;
    
    console.log(`Processing refund:
      Conference ID: ${conference.conferenceId}
      User ID: ${userId}
      Refund Amount: ₹${refundAmount}
      Rejection Note: ${rejectionNote}`);
    
    // Find or create user's wallet
    let wallet = await Wallet.findOne({
      userId: userId,
      userType: "PressConferenceUser"
    });
    
    if (!wallet) {
      wallet = new Wallet({
        userId: userId,
        userType: "PressConferenceUser",
        balance: 0
      });
    }
    
    // Credit refund amount to wallet
    const previousBalance = wallet.balance || 0;
    wallet.balance = Number(previousBalance) + Number(refundAmount);
    
    const refundTransaction = {
      type: "credit",
      amount: refundAmount,
      description: `Refund for rejected paid conference: ${conference.conferenceId}`,
      status: "success",
      date: new Date(),
      refundId: `REF-${Date.now()}-${conference.conferenceId}`,
      rejectionReason: rejectionNote || "Conference rejected by admin"
    };
    
    wallet.transactions.push(refundTransaction);
    
    await wallet.save();
    
    // Store refund details in conference
    conference.refundDetails = {
      refundAmount,
      refundedAt: new Date(),
      rejectionNote: rejectionNote || "Conference rejected by admin",
      refundTransactionId: refundTransaction.refundId
    };
    
    console.log(`✅ Refund processed successfully:
      - Conference ID: ${conference.conferenceId}
      - User ID: ${userId}
      - Previous Balance: ₹${previousBalance}
      - Refund Amount: ₹${refundAmount}
      - New Balance: ₹${wallet.balance}
      - Transaction ID: ${refundTransaction.refundId}
      - Rejection Reason: ${rejectionNote}`);
    
  } catch (error) {
    console.error("Error in handleRejectionWithRefund:", error);
    throw error;
  }
};

// Mark paid conference as completed and credit reporters
const completePaidConference = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { reporterId, idempotencyKey } = req.body; // Get reporterId and idempotencyKey from request body
    const adminId = req.admin._id;

    // 🔑 CRITICAL FIX: Validate idempotency key to prevent duplicate approvals
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Idempotency key is required to prevent duplicate approvals"
      });
    }

    console.log(`Processing proof approval for conference: ${conferenceId}, reporter: ${reporterId} by admin: ${adminId} with key: ${idempotencyKey}`);

    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    if (!["approved", "modified", "running"].includes(conference.status)) {
      return res.status(400).json({
        success: false,
        message: "Conference must be approved, modified, or running to approve proofs"
      });
    }

    // If reporterId is provided, approve individual proof
    if (reporterId) {
      console.log("=== PROOF APPROVAL DEBUG ===");
      console.log("Looking for reporter ID:", reporterId);
      console.log("Reporter ID type:", typeof reporterId);
      console.log("Conference ID:", conferenceId);
      console.log("Conference status:", conference.status);
      console.log("Total accepted reporters:", conference.acceptedReporters?.length || 0);
      
      if (conference.acceptedReporters && conference.acceptedReporters.length > 0) {
        console.log("Available reporters:");
        conference.acceptedReporters.forEach((r, index) => {
          console.log(`  Reporter ${index + 1}:`, {
            reporterId: r.reporterId,
            reporterIdString: r.reporterId?.toString(),
            reporterName: r.reporterName,
            proofSubmitted: r.proofSubmitted,
            proofStatus: r.proof?.status
          });
        });
      } else {
        console.log("No accepted reporters found in conference");
        return res.status(404).json({
          success: false,
          message: "No accepted reporters found in this conference"
        });
      }
      
      const reporter = conference.acceptedReporters.find(r => 
        r.reporterId && r.reporterId.toString() === reporterId.toString()
      );
      
      if (!reporter) {
        console.log("Reporter not found. Available reporter IDs:", 
          conference.acceptedReporters.map(r => r.reporterId?.toString()).filter(Boolean)
        );
        console.log("Looking for:", reporterId.toString());
        return res.status(404).json({
          success: false,
          message: "Reporter not found in this conference"
        });
      }
      
      console.log("Found reporter:", {
        reporterId: reporter.reporterId,
        reporterName: reporter.reporterName,
        proofSubmitted: reporter.proofSubmitted,
        proofStatus: reporter.proof?.status
      });

      if (!reporter.proofSubmitted) {
        return res.status(400).json({
          success: false,
          message: "Reporter has not submitted proof yet"
        });
      }

      // Check if proof exists
      if (!reporter.proof) {
        return res.status(400).json({
          success: false,
          message: "No proof found for this reporter"
        });
      }

      // 🔑 CRITICAL FIX: Use atomic operation with idempotency check to prevent duplicate approvals
      const approvalResult = await PaidConference.findOneAndUpdate(
        {
          conferenceId: conferenceId,
          "acceptedReporters.reporterId": reporterId,
          "acceptedReporters.proofSubmitted": true,
          // CRITICAL: Only allow if proof is not already approved (but allow rejected proofs to be re-approved)
          "acceptedReporters.proof.status": { $in: ["pending", "rejected"] },
          // CRITICAL: Check idempotency key hasn't been used
          "acceptedReporters.proof.idempotencyKey": { $ne: idempotencyKey }
        },
        {
          $set: {
            "acceptedReporters.$.proof.status": "approved",
            "acceptedReporters.$.proof.approvedAt": new Date(),
            "acceptedReporters.$.proof.approvedBy": adminId,
            "acceptedReporters.$.proof.idempotencyKey": idempotencyKey,
            "acceptedReporters.$.status": "completed"
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!approvalResult) {
        console.log("Proof approval failed - likely already approved or invalid state:", {
          conferenceId: conferenceId,
          reporterId: reporterId,
          idempotencyKey: idempotencyKey
        });
        return res.status(400).json({
          success: false,
          message: "Proof is already approved or invalid state"
        });
      }

      // Credit the reporter's wallet after successful approval
      if (conference.commissionDetails?.amountPerReporter > 0) {
        await creditReporterWallet(
          reporter.reporterId, 
          conference.commissionDetails.amountPerReporter, 
          conference.conferenceId
        );
      }

      console.log(`Proof approved for reporter ${reporterId} in conference ${conferenceId}`);

      // 🔑 CRITICAL FIX: Check completion based on required number of reporters, not all accepted
      const requiredReporters = approvalResult.numberOfReporters;
      const completedReporters = approvalResult.acceptedReporters.filter(r => 
        r.proofSubmitted && r.proof?.status === 'approved'
      );

      console.log("Completion check:", {
        requiredReporters: requiredReporters,
        completedReporters: completedReporters.length,
        totalAccepted: approvalResult.acceptedReporters.length
      });

      if (completedReporters.length >= requiredReporters) {
        // Mark entire conference as completed
        await PaidConference.findOneAndUpdate(
          { conferenceId: conferenceId },
          { $set: { status: "completed" } }
        );
        // Update completion details
        await PaidConference.findOneAndUpdate(
          { conferenceId: conferenceId },
          { 
            $set: { 
              completedAt: new Date(),
              completedBy: adminId
            } 
          }
        );
        
        console.log(`All proofs approved. Conference ${conferenceId} marked as completed`);
        
        return res.status(200).json({
          success: true,
          message: "Proof approved and conference completed successfully",
          conferenceCompleted: true
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "Proof approved successfully",
          conferenceCompleted: false
        });
      }
    } else {
      // If no reporterId provided, complete entire conference (legacy behavior)
      // Credit all accepted reporters
      if (conference.acceptedReporters && conference.acceptedReporters.length > 0) {
        for (const acceptedReporter of conference.acceptedReporters) {
          if (acceptedReporter.status === "accepted" && conference.commissionDetails?.amountPerReporter > 0) {
            await creditReporterWallet(
              acceptedReporter.reporterId, 
              conference.commissionDetails.amountPerReporter, 
              conference.conferenceId
            );
            
            // Update reporter status to completed
            acceptedReporter.status = "completed";
            if (acceptedReporter.proof) {
              acceptedReporter.proof.status = "approved";
              acceptedReporter.proof.approvedAt = new Date();
              acceptedReporter.proof.approvedBy = adminId;
            }
          }
        }
      }

      // Update conference status to completed
      conference.status = "completed";
      conference.completedAt = new Date();
      conference.completedBy = adminId;

      await conference.save();

      console.log(`Paid conference ${conferenceId} completed successfully`);

      return res.status(200).json({
        success: true,
        message: "Conference completed and reporters credited successfully",
        data: conference
      });
    }
  } catch (error) {
    console.error("Error completing paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Helper function to process refund to press user's wallet
const processRefundToPressUser = async (userId, refundAmount, conferenceId, refundReason) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    console.log(`Processing refund to press user wallet:
      User ID: ${userId}
      Refund Amount: ₹${refundAmount}
      Conference ID: ${conferenceId}
      Reason: ${refundReason}`);
    
    // Find or create press user's wallet within transaction
    let wallet = await Wallet.findOne({
      userId: userId,
      userType: "PressConferenceUser"
    }).session(session);
    
    if (!wallet) {
      wallet = new Wallet({
        userId: userId,
        userType: "PressConferenceUser",
        balance: 0,
        transactions: []
      });
    }
    
    // Credit refund amount to wallet
    const previousBalance = wallet.balance || 0;
    const newBalance = Number(previousBalance) + Number(refundAmount);
    
    // Add transaction record
    const transactionRecord = {
      type: "credit",
      amount: refundAmount,
      description: refundReason,
      status: "success",
      date: new Date(),
      transactionId: `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conferenceId: conferenceId,
      refundType: "incomplete_conference"
    };
    
    wallet.balance = newBalance;
    wallet.transactions.push(transactionRecord);
    
    await wallet.save({ session });
    
    await session.commitTransaction();
    
    console.log(`✅ Press user wallet refunded successfully:
      Previous Balance: ₹${previousBalance}
      Refund Amount: ₹${refundAmount}
      New Balance: ₹${newBalance}
      Transaction ID: ${transactionRecord.transactionId}`);
    
    return {
      success: true,
      previousBalance: previousBalance,
      newBalance: newBalance,
      transactionId: transactionRecord.transactionId,
      refundAmount: refundAmount
    };
    
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error processing refund to press user wallet, transaction rolled back:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Helper function to credit reporter's wallet with transaction safety
const creditReporterWallet = async (reporterId, amount, conferenceId) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    console.log(`Crediting reporter wallet with transaction:
      Reporter ID: ${reporterId}
      Amount: ₹${amount}
      Conference ID: ${conferenceId}`);
    
    // Find or create reporter's wallet within transaction
    let wallet = await Wallet.findOne({
      userId: reporterId,
      userType: "Reporter"
    }).session(session);
    
    if (!wallet) {
      wallet = new Wallet({
        userId: reporterId,
        userType: "Reporter",
        balance: 0,
        transactions: []
      });
    }
    
    // 🔑 CRITICAL FIX: Use atomic operation to prevent race conditions
    const previousBalance = wallet.balance || 0;
    const newBalance = Number(previousBalance) + Number(amount);
    
    // Add transaction record
    const transactionRecord = {
      type: "credit",
      amount: amount,
      description: `Payment for completed paid conference: ${conferenceId}`,
      status: "success",
      date: new Date(),
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    wallet.balance = newBalance;
    wallet.transactions.push(transactionRecord);
    
    await wallet.save({ session });
    
    await session.commitTransaction();
    
    console.log(`✅ Reporter wallet credited successfully with transaction:
      Previous Balance: ₹${previousBalance}
      Credit Amount: ₹${amount}
      New Balance: ₹${newBalance}
      Transaction ID: ${transactionRecord.transactionId}`);
    
    return {
      success: true,
      previousBalance: previousBalance,
      newBalance: newBalance,
      transactionId: transactionRecord.transactionId
    };
    
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error crediting reporter wallet, transaction rolled back:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Reject proof for a specific reporter in a paid conference
const rejectPaidConferenceProof = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { reporterId, rejectReason } = req.body;
    const adminId = req.admin._id;

    if (!conferenceId || !reporterId || !rejectReason) {
      return res.status(400).json({
        success: false,
        message: "Conference ID, reporter ID, and rejection reason are required"
      });
    }

    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    // Find the reporter in acceptedReporters array
    const reporterIndex = conference.acceptedReporters.findIndex(
      reporter => reporter.reporterId.toString() === reporterId
    );

    if (reporterIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Reporter not found in accepted reporters list"
      });
    }

    const reporter = conference.acceptedReporters[reporterIndex];
    
    // Check if proof exists
    if (!reporter.proof) {
      return res.status(400).json({
        success: false,
        message: "No proof found for this reporter"
      });
    }
    
    // Check if proof is already approved
    if (reporter.proof?.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Cannot reject an already approved proof"
      });
    }

    // Update the proof status to rejected
    conference.acceptedReporters[reporterIndex].proof.status = "rejected";
    conference.acceptedReporters[reporterIndex].proof.adminNote = rejectReason;
    conference.acceptedReporters[reporterIndex].proof.rejectedAt = new Date();
    conference.acceptedReporters[reporterIndex].proof.rejectedBy = adminId;
    
    // 🔑 CRITICAL FIX: Clear idempotency key so proof can be re-approved
    conference.acceptedReporters[reporterIndex].proof.idempotencyKey = undefined;
    
    // Mark proof as not submitted after rejection
    conference.acceptedReporters[reporterIndex].proofSubmitted = false;

    await conference.save();

    res.status(200).json({
      success: true,
      message: "Proof rejected successfully"
    });

  } catch (error) {
    console.error("Error rejecting proof:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get detailed information about a specific paid conference
const getPaidConferenceDetails = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    if (!conferenceId) {
      return res.status(400).json({
        success: false,
        message: "Conference ID is required"
      });
    }

    const conference = await PaidConference.findOne({ conferenceId })
      .populate('submittedBy', 'name email')
      .populate('acceptedReporters.reporterId', 'name email iinsafId city state');

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    // Process the conference data to include proof statistics
    const acceptedReporters = conference.acceptedReporters || [];
    const totalAccepted = acceptedReporters.length;
    const totalProofSubmitted = acceptedReporters.filter(reporter => reporter.proofSubmitted).length;
    const totalProofPending = totalAccepted - totalProofSubmitted;

    const processedConference = {
      ...conference.toObject(),
      totalAccepted,
      totalProofSubmitted,
      totalProofPending
    };

    res.status(200).json({
      success: true,
      data: processedConference
    });

  } catch (error) {
    console.error("Error fetching conference details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get completed paid conferences from PaidConference collection
const getCompletedPaidConferences = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search filter
    let searchFilter = {};
    if (search.trim()) {
      searchFilter = {
        $or: [
          { conferenceId: { $regex: search, $options: "i" } },
          { topic: { $regex: search, $options: "i" } },
          { state: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { "submittedBy.name": { $regex: search, $options: "i" } },
          { "acceptedReporters.reporterName": { $regex: search, $options: "i" } },
          { "acceptedReporters.proof.channelName": { $regex: search, $options: "i" } },
        ],
      };
    }

    // Fetch completed conferences from PaidConference collection
    const PaidConference = require("../../models/pressConference/paidConference");
    const User = require("../../models/userModel/userModel");

    // Debug: Check total conferences first
    const totalConferences = await PaidConference.countDocuments({});
    console.log(`Total paid conferences in database: ${totalConferences}`);
    
    // Debug: Check conferences with different statuses
    const statusCounts = await PaidConference.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    console.log("Conference status counts:", statusCounts);
    
    // Debug: Check conferences with approved proofs
    const conferencesWithApprovedProofs = await PaidConference.countDocuments({
      "acceptedReporters.proofSubmitted": true,
      "acceptedReporters.proof.status": "approved"
    });
    console.log(`Conferences with approved proofs: ${conferencesWithApprovedProofs}`);
    
    // For debugging: Get all conferences first, then filter
    const allConferences = await PaidConference.find({})
      .populate("submittedBy", "name email")
      .populate("acceptedReporters.reporterId", "name email iinsafId state city organization")
      .sort({ createdAt: -1 });
    
    console.log(`Total conferences fetched: ${allConferences.length}`);
    
    // Filter conferences that have approved proofs
    const completedConferences = allConferences.filter(conference => {
      const hasApprovedProofs = conference.acceptedReporters?.some(reporter => 
        reporter.proofSubmitted && reporter.proof?.status === "approved"
      );
      const isCompleted = conference.status === "completed";
      
      console.log(`Conference ${conference.conferenceId}:`, {
        status: conference.status,
        hasApprovedProofs,
        isCompleted,
        acceptedReporters: conference.acceptedReporters?.length || 0
      });
      
      return hasApprovedProofs || isCompleted;
    });
    
    console.log(`Found ${completedConferences.length} completed conferences after filtering`);

    // Get total count for pagination (simplified for debugging)
    const total = completedConferences.length;

    // Process each completed conference
    const processedConferences = await Promise.all(completedConferences.map(async (conference) => {
      const acceptedReporters = conference.acceptedReporters || [];
      
      // Get completed reporters (those with approved proofs)
      const completedReporters = acceptedReporters
        .filter(reporter => {
          // Fix: Check if proof is submitted and approved, regardless of reporter status
          return reporter.proofSubmitted && reporter.proof?.status === "approved";
        })
        .map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.reporterId?.iinsafId || "N/A",
          reporterName: reporter.reporterName || reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
          reporterOrganization: reporter.reporterId?.organization || "N/A",
          status: "completed",
          acceptedAt: reporter.acceptedAt,
          completedAt: reporter.proof?.approvedAt || reporter.acceptedAt,
          rejectNote: null,
          proofDetails: reporter.proof ? {
            channelName: reporter.proof.channelName,
            platform: reporter.proof.platform,
            videoLink: reporter.proof.videoLink,
            duration: reporter.proof.duration,
            screenshot: reporter.proof.screenshot,
            submittedAt: reporter.proof.submittedAt,
            adminRejectNote: reporter.proof.adminNote,
            rejectedAt: reporter.proof.rejectedAt,
            proofStatus: reporter.proof.status
          } : null
        }));

      // Get accepted reporters (those who accepted but haven't completed)
      const acceptedButNotCompleted = acceptedReporters
        .filter(reporter => {
          // Reporter is accepted but either hasn't submitted proof or proof is not approved
          const hasNotCompleted = !reporter.proofSubmitted || reporter.proof?.status !== "approved";
          return reporter.status === "accepted" && hasNotCompleted;
        })
        .map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.reporterId?.iinsafId || "N/A",
          reporterName: reporter.reporterName || reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
          reporterOrganization: reporter.reporterId?.organization || "N/A",
          status: "accepted",
          acceptedAt: reporter.acceptedAt,
          rejectedAt: null,
          rejectNote: null,
          proofDetails: reporter.proof ? {
            channelName: reporter.proof.channelName,
            platform: reporter.proof.platform,
            videoLink: reporter.proof.videoLink,
            duration: reporter.proof.duration,
            screenshot: reporter.proof.screenshot,
            submittedAt: reporter.proof.submittedAt,
            adminRejectNote: reporter.proof.adminNote,
            rejectedAt: reporter.proof.rejectedAt,
            proofStatus: reporter.proof.status
          } : null
        }));

      // Get rejected reporters
      const rejectedReporters = acceptedReporters
        .filter(reporter => reporter.status === "rejected")
        .map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.reporterId?.iinsafId || "N/A",
          reporterName: reporter.reporterName || reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
          reporterOrganization: reporter.reporterId?.organization || "N/A",
          status: "rejected",
          acceptedAt: reporter.acceptedAt,
          rejectedAt: reporter.rejectedAt,
          rejectNote: reporter.rejectNote
        }));

      // Calculate statistics
      const totalRequiredReporters = conference.numberOfReporters || 0; // Total reporters required for this conference
      const totalReporters = acceptedReporters.length;
      const totalCompletedReporters = completedReporters.length;
      const totalAcceptedReporters = acceptedButNotCompleted.length;
      const totalRejectedReporters = rejectedReporters.length;
      
      // Calculate total targeted users (will be updated after fetching all targeted users)
      let totalTargetedUsers = 0;
      let totalNeverRespondedUsers = 0;
      
      // Calculate completion ratio
      const completionRatio = totalRequiredReporters > 0 ? 
        `${totalCompletedReporters}/${totalRequiredReporters}` : 
        `${totalCompletedReporters}/${totalReporters}`;
      
      const completionPercentage = totalRequiredReporters > 0 ? 
        ((totalCompletedReporters / totalRequiredReporters) * 100).toFixed(1) : 
        (totalReporters > 0 ? ((totalCompletedReporters / totalReporters) * 100).toFixed(1) : 0);

      // Proof statistics
      const proofStatistics = {
        totalProofsSubmitted: acceptedReporters.filter(r => r.proofSubmitted).length,
        totalProofsApproved: acceptedReporters.filter(r => r.proofSubmitted && r.proof?.status === "approved").length,
        totalProofsRejected: acceptedReporters.filter(r => r.proofSubmitted && r.proof?.status === "rejected").length,
        totalProofPending: acceptedReporters.filter(r => r.status === "accepted" && !r.proofSubmitted).length
      };

      // Completion metrics
      const completionMetrics = {
        acceptanceRate: totalReporters > 0 ? ((totalAcceptedReporters + totalCompletedReporters) / totalReporters * 100).toFixed(1) : 0,
        completionRate: totalAcceptedReporters > 0 ? (totalCompletedReporters / totalAcceptedReporters * 100).toFixed(1) : 0,
        proofSubmissionRate: totalAcceptedReporters > 0 ? (proofStatistics.totalProofsSubmitted / totalAcceptedReporters * 100).toFixed(1) : 0,
        averageResponseTime: 0, // Calculate if needed
        averageCompletionTime: 0 // Calculate if needed
      };

      return {
        ...conference.toObject(),
        completedReporters,
        acceptedReporters: acceptedButNotCompleted,
        rejectedReporters,
        pendingReporters: [], // No pending reporters in completed conferences
        totalRequiredReporters,
        totalReporters,
        totalCompletedReporters,
        totalAcceptedReporters,
        totalRejectedReporters,
        totalPendingReporters: totalNeverRespondedUsers,
        totalRespondedReporters: totalReporters + totalRejectedReporters,
        totalNeverRespondedReporters: totalNeverRespondedUsers,
        totalTargetedUsers,
        completionRatio,
        // Include refund details if they exist
        refundDetails: conference.refundDetails || null,
        
        // Debug: Log refund details
        debugRefundDetails: conference.refundDetails ? {
          refundAmount: conference.refundDetails.refundAmount,
          refundReason: conference.refundDetails.refundReason,
          refundTransactionId: conference.refundDetails.refundTransactionId,
          shortfallReporters: conference.refundDetails.shortfallReporters,
          refundedAt: conference.refundDetails.refundedAt
        } : null,
        completionPercentage,
        proofStatistics,
        completionMetrics,
        allTargetedUsers: await (async () => {
          // Get ALL reporters who were targeted for this conference (not just accepted ones)
          let allTargetedReporters = [];

          if (conference.reporterId && conference.reporterId.length > 0) {
            // Specific reporter selection
            allTargetedReporters = await User.find({
              _id: { $in: conference.reporterId },
              role: "Reporter",
              verifiedReporter: true
            }).select("name email mobile iinsafId state city organization");
          } else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
            // Admin selected states
            const query = {
              role: "Reporter",
              verifiedReporter: true,
              state: { $in: conference.adminSelectState }
            };
            
            if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
              query.city = { $in: conference.adminSelectCities };
            }
            
            allTargetedReporters = await User.find(query).select("name email mobile iinsafId state city organization");
          } else if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
            // Admin selected cities
            allTargetedReporters = await User.find({
              role: "Reporter",
              verifiedReporter: true,
              city: { $in: conference.adminSelectCities }
            }).select("name email mobile iinsafId state city organization");
          } else {
            // Default location-based targeting
            allTargetedReporters = await User.find({
              role: "Reporter",
              verifiedReporter: true,
              state: conference.state,
              city: conference.city
            }).select("name email mobile iinsafId state city organization");
          }

          // Update statistics with actual targeted users count
          totalTargetedUsers = allTargetedReporters.length;
          totalNeverRespondedUsers = allTargetedReporters.length - totalReporters - totalRejectedReporters;

          // Create maps for quick lookup
          const acceptedReporterMap = {};
          const rejectedReporterMap = {};
          
          acceptedReporters.forEach(reporter => {
            acceptedReporterMap[reporter.reporterId.toString()] = reporter;
          });
          
          rejectedReporters.forEach(reporter => {
            rejectedReporterMap[reporter.reporterId.toString()] = reporter;
          });

          // Combine all targeted reporters with their response status
          return allTargetedReporters.map(reporter => {
            const acceptedReporter = acceptedReporterMap[reporter._id.toString()];
            const rejectedReporter = rejectedReporterMap[reporter._id.toString()];
            
            let workStatus = {
              status: "pending",
              acceptedAt: null,
              rejectedAt: null,
              completedAt: null,
              rejectNote: null,
              proofSubmitted: false,
              lastUpdated: null
            };
            
            let proofDetails = null;

            if (acceptedReporter) {
              workStatus = {
                status: acceptedReporter.status,
                acceptedAt: acceptedReporter.acceptedAt,
                rejectedAt: null,
                completedAt: acceptedReporter.proof?.approvedAt || null,
                rejectNote: null,
                proofSubmitted: acceptedReporter.proofSubmitted,
                lastUpdated: acceptedReporter.updatedAt
              };
              
              if (acceptedReporter.proof) {
                proofDetails = {
                  channelName: acceptedReporter.proof.channelName,
                  platform: acceptedReporter.proof.platform,
                  videoLink: acceptedReporter.proof.videoLink,
                  duration: acceptedReporter.proof.duration,
                  screenshot: acceptedReporter.proof.screenshot,
                  submittedAt: acceptedReporter.proof.submittedAt,
                  adminRejectNote: acceptedReporter.proof.adminNote,
                  rejectedAt: acceptedReporter.proof.rejectedAt,
                  proofStatus: acceptedReporter.proof.status
                };
              }
            } else if (rejectedReporter) {
              workStatus = {
                status: "rejected",
                acceptedAt: null,
                rejectedAt: rejectedReporter.rejectedAt,
                completedAt: null,
                rejectNote: rejectedReporter.rejectNote,
                proofSubmitted: false,
                lastUpdated: rejectedReporter.updatedAt
              };
            }

            return {
              reporterId: reporter._id,
              iinsafId: reporter.iinsafId || "N/A",
              reporterName: reporter.name || "N/A",
              reporterEmail: reporter.email || "N/A",
              reporterMobile: reporter.mobile || "N/A",
              reporterState: reporter.state || "N/A",
              reporterCity: reporter.city || "N/A",
              reporterOrganization: reporter.organization || "N/A",
              workStatus,
              proofDetails,
              metadata: {
                hasConferenceInPanel: true,
                responseTime: workStatus.acceptedAt ? 
                  Math.round((new Date(workStatus.acceptedAt) - new Date(conference.createdAt)) / (1000 * 60 * 60 * 24)) : null, // days
                completionTime: workStatus.completedAt ? 
                  Math.round((new Date(workStatus.completedAt) - new Date(workStatus.acceptedAt)) / (1000 * 60 * 60 * 24)) : null // days
              }
            };
          });
        })()
      };
    }));

    console.log(`Found ${processedConferences.length} completed paid conferences`);

    return res.status(200).json({
      success: true,
      data: {
        conferences: processedConferences,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching completed paid conferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching completed paid conferences",
    });
  }
};

// Get completion details before marking conference as complete
const getCompletionDetails = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    if (!conferenceId) {
      return res.status(400).json({
        success: false,
        message: "Conference ID is required"
      });
    }

    const conference = await PaidConference.findOne({ conferenceId })
      .populate('submittedBy', 'name email');
      
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    // Count completed reporters
    const completedReporters = conference.acceptedReporters.filter(r => 
      r.proofSubmitted && r.proof?.status === 'approved'
    );

    const requiredReporters = conference.numberOfReporters;
    const actualCompleted = completedReporters.length;
    const amountPerReporter = conference.commissionDetails?.amountPerReporter || 
                             (conference.paymentAmount / requiredReporters);
    
    // Calculate payment distribution
    const totalToReporters = actualCompleted * amountPerReporter;
    
    // Calculate refund if needed
    const shortfall = requiredReporters - actualCompleted;
    const refundAmount = shortfall > 0 ? shortfall * amountPerReporter : 0;
    const willRefund = refundAmount > 0;
    
    const completionDetails = {
      conferenceId: conference.conferenceId,
      topic: conference.topic,
      requiredReporters: requiredReporters,
      completedReporters: actualCompleted,
      totalPayment: conference.paymentAmount,
      amountPerReporter: amountPerReporter,
      totalToReporters: totalToReporters,
      willRefund: willRefund,
      refundAmount: refundAmount,
      shortfallReporters: shortfall,
      refundReason: willRefund ? 
        `Incomplete conference: ${actualCompleted}/${requiredReporters} reporters completed` : 
        null,
      pressUserName: conference.submittedBy?.name || 'N/A',
      pressUserEmail: conference.submittedBy?.email || 'N/A',
      status: conference.status,
      completionRatio: `${actualCompleted}/${requiredReporters}`
    };

    res.status(200).json({
      success: true,
      data: completionDetails
    });
  } catch (error) {
    console.error("Error fetching completion details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Debug endpoint to check database state
const debugPaidConferences = async (req, res) => {
  try {
    const PaidConference = require("../../models/pressConference/paidConference");
    
    // Get all conferences
    const allConferences = await PaidConference.find({})
      .populate("submittedBy", "name email")
      .populate("acceptedReporters.reporterId", "name email iinsafId state city organization");
    
    console.log(`Total conferences in database: ${allConferences.length}`);
    
    // Analyze each conference
    const analysis = allConferences.map(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      const approvedProofs = acceptedReporters.filter(reporter => 
        reporter.proofSubmitted && reporter.proof?.status === "approved"
      );
      
      return {
        conferenceId: conference.conferenceId,
        status: conference.status,
        numberOfReporters: conference.numberOfReporters,
        totalAcceptedReporters: acceptedReporters.length,
        approvedProofs: approvedProofs.length,
        hasApprovedProofs: approvedProofs.length > 0,
        isCompleted: conference.status === "completed",
        acceptedReporters: acceptedReporters.map(r => ({
          reporterId: r.reporterId,
          status: r.status,
          proofSubmitted: r.proofSubmitted,
          proofStatus: r.proof?.status
        }))
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalConferences: allConferences.length,
        analysis: analysis
      }
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Manual completion endpoint for testing/debugging
const manuallyCompleteConference = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const adminId = req.admin._id;

    if (!conferenceId) {
      return res.status(400).json({
        success: false,
        message: "Conference ID is required"
      });
    }

    const conference = await PaidConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found"
      });
    }

    // Check if conference already completed
    if (conference.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Conference is already completed"
      });
    }

    // Get accepted reporters array
    const acceptedReporters = conference.acceptedReporters || [];

    // Count completed reporters
    const completedReporters = acceptedReporters.filter(r => 
      r.proofSubmitted && r.proof?.status === 'approved'
    );

    const requiredReporters = conference.numberOfReporters;
    const actualCompleted = completedReporters.length;

    console.log("Manual completion check:", {
      conferenceId: conferenceId,
      requiredReporters: requiredReporters,
      completedReporters: actualCompleted,
      totalAccepted: conference.acceptedReporters.length
    });

    // Calculate refund if fewer reporters completed than required
    let refundAmount = 0;
    let refundDetails = null;

    if (actualCompleted < requiredReporters) {
      const shortfall = requiredReporters - actualCompleted;
      const amountPerReporter = conference.commissionDetails?.amountPerReporter || 
                               (conference.paymentAmount / requiredReporters);
      
      refundAmount = shortfall * amountPerReporter;
      
      console.log(`Refund calculation:`, {
        shortfall: shortfall,
        amountPerReporter: amountPerReporter,
        refundAmount: refundAmount,
        totalPayment: conference.paymentAmount
      });

      // Process refund to press user's wallet
      if (refundAmount > 0) {
        refundDetails = await processRefundToPressUser(
          conference.submittedBy, 
          refundAmount, 
          conference.conferenceId,
          `Refund for incomplete conference: ${shortfall} reporter(s) short`
        );
      }
    }

    // Auto-reject reporters who didn't submit proofs
    const incompleteReporters = acceptedReporters.filter(reporter => 
      !reporter.proofSubmitted || reporter.proof?.status !== "approved"
    );

    console.log(`Found ${incompleteReporters.length} incomplete reporters to auto-reject`);

    // Move incomplete reporters to rejectedReporters array
    incompleteReporters.forEach(reporter => {
      const rejectionData = {
        reporterId: reporter.reporterId,
        reporterName: reporter.reporterName || reporter.reporterId?.name || "N/A",
        rejectedAt: new Date(),
        rejectNote: "Auto-rejected: Conference completed without proof submission",
        rejectedBy: adminId,
        rejectionReason: "incomplete_proof"
      };

      // Add to rejectedReporters array
      if (!conference.rejectedReporters) {
        conference.rejectedReporters = [];
      }
      conference.rejectedReporters.push(rejectionData);

      console.log(`Auto-rejected reporter ${reporter.reporterId} for conference ${conferenceId}`);
    });

    // Remove incomplete reporters from acceptedReporters array
    conference.acceptedReporters = conference.acceptedReporters.filter(reporter => 
      reporter.proofSubmitted && reporter.proof?.status === "approved"
    );

    // Mark conference as completed
    conference.status = "completed";
    conference.completedAt = new Date();
    conference.completedBy = adminId;

    // Store refund details if any
    if (refundDetails) {
      const refundData = {
        refundAmount: refundAmount,
        refundedAt: new Date(),
        refundReason: `Incomplete conference: ${actualCompleted}/${requiredReporters} reporters completed`,
        refundTransactionId: refundDetails.transactionId,
        shortfallReporters: requiredReporters - actualCompleted
      };
      
      console.log(`Refund data to be saved:`, refundData);
      console.log(`Refund details from processRefundToPressUser:`, refundDetails);
      
      conference.refundDetails = refundData;
      
      console.log(`Conference refundDetails after assignment:`, conference.refundDetails);
    }

    await conference.save();
    
    // Debug: Check if refund details were saved correctly
    const savedConference = await PaidConference.findOne({ conferenceId });
    console.log(`Saved conference refundDetails:`, savedConference.refundDetails);

    console.log(`Conference ${conferenceId} manually marked as completed`);

    const responseData = {
      conferenceId: conferenceId,
      status: conference.status,
      completedAt: conference.completedAt,
      completedReporters: actualCompleted,
      requiredReporters: requiredReporters,
      completionRatio: `${actualCompleted}/${requiredReporters}`,
      autoRejectedReporters: incompleteReporters.length
    };

    // Add refund information if applicable
    if (refundDetails) {
      responseData.refund = {
        amount: refundAmount,
        reason: `Incomplete conference: ${actualCompleted}/${requiredReporters} reporters completed`,
        shortfallReporters: requiredReporters - actualCompleted,
        transactionId: refundDetails.transactionId,
        newWalletBalance: refundDetails.newBalance
      };
    }

    // Add auto-rejection information
    if (incompleteReporters.length > 0) {
      responseData.autoRejection = {
        count: incompleteReporters.length,
        reason: "Auto-rejected: Conference completed without proof submission",
        reporters: incompleteReporters.map(reporter => ({
          reporterId: reporter.reporterId,
          reporterName: reporter.reporterName || reporter.reporterId?.name || "N/A",
          rejectionReason: "incomplete_proof"
        }))
      };
    }

    let message = "Conference manually marked as completed";
    if (refundDetails && incompleteReporters.length > 0) {
      message = `Conference completed with refund processed (₹${refundAmount}) and ${incompleteReporters.length} reporter(s) auto-rejected for incomplete proof.`;
    } else if (refundDetails) {
      message = `Conference completed with refund processed. ₹${refundAmount} refunded to press user wallet.`;
    } else if (incompleteReporters.length > 0) {
      message = `Conference completed. ${incompleteReporters.length} reporter(s) auto-rejected for incomplete proof.`;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: responseData
    });

  } catch (error) {
    console.error("Error manually completing conference:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  calculatePaidConferencePrice,
  createPaidConferenceOrder,
  submitPaidConference,
  getUserPaidConferences,
  getAllPaidConferences,
  getPaidConferencesWithProofs,
  adminActionPaidConference,
  verifyPayment,
  getPaymentHistory,
  completePaidConference,
  rejectPaidConferenceProof,
  getPaidConferenceDetails,
  getCompletedPaidConferences,
  manuallyCompleteConference,
  debugPaidConferences,
  getCompletionDetails
};
