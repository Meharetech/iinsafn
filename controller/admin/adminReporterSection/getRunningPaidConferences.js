const PaidConference = require("../../../models/pressConference/paidConference");
const User = require("../../../models/userModel/userModel");

const getRunningPaidConferences = async (req, res) => {
  try {
    console.log("Getting running paid conferences...");
    console.log("Admin user:", req.admin);
    
    // Get all approved, modified, and running paid conferences
    const runningConferences = await PaidConference.find({ 
      status: { $in: ["approved", "modified", "running"] }
    }).populate("submittedBy", "name email organization pressConferenceId");
    
    console.log("Found running paid conferences:", runningConferences.length);

    // Process conferences to add proof statistics
    const processedConferences = runningConferences.map(conference => {
      const acceptedReporters = conference.acceptedReporters || [];
      const totalAccepted = acceptedReporters.length;
      const totalProofSubmitted = acceptedReporters.filter(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected"
      ).length;
      const totalProofPending = totalAccepted - totalProofSubmitted;
      
      // Get reporters with submitted proofs (excluding rejected ones)
      const reportersWithProofs = acceptedReporters.filter(reporter => 
        reporter.proofSubmitted && reporter.proof?.status !== "rejected"
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

    // Filter to only show conferences with submitted proofs (excluding rejected ones)
    const conferencesWithProofs = processedConferences.filter(conf => conf.totalProofSubmitted > 0);
    
    console.log("Conferences with submitted proofs:", conferencesWithProofs.length);

    res.status(200).json({
      success: true,
      message: "Running paid conferences with submitted proofs fetched successfully",
      data: conferencesWithProofs,
      totalConferences: conferencesWithProofs.length,
      totalProofs: conferencesWithProofs.reduce((sum, conf) => sum + conf.totalProofSubmitted, 0)
    });
  } catch (error) {
    console.error("Error fetching running paid conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running paid conferences",
    });
  }
};

// Get specific paid conference with all accepted reporters
const getPaidConferenceWithReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    const conference = await PaidConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified", "running"] }
    }).populate("submittedBy", "name email organization pressConferenceId");

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found",
      });
    }

    const acceptedReporters = conference.acceptedReporters || [];
    const totalAccepted = acceptedReporters.length;
    const totalProofSubmitted = acceptedReporters.filter(reporter => reporter.proofSubmitted).length;
    const totalProofPending = totalAccepted - totalProofSubmitted;

    const conferenceWithReporters = {
      ...conference.toObject(),
      acceptedReporters: acceptedReporters.map(reporter => ({
        reporterId: reporter.reporterId,
        reporterName: reporter.reporterName,
        reporterEmail: reporter.reporterEmail,
        iinsafId: reporter.reporterId?.iinsafId || "N/A",
        reporterState: reporter.reporterId?.state || "N/A",
        reporterCity: reporter.reporterId?.city || "N/A",
        acceptedAt: reporter.acceptedAt,
        proofSubmitted: reporter.proofSubmitted,
        proof: reporter.proof,
        proofStatus: reporter.proof?.status || "pending"
      })),
      totalAccepted,
      totalProofSubmitted,
      totalProofPending
    };

    res.status(200).json({
      success: true,
      message: "Paid conference with accepted reporters fetched successfully",
      data: conferenceWithReporters,
    });
  } catch (error) {
    console.error("Error fetching paid conference with reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching paid conference with reporters",
    });
  }
};

// Get all reporters who were notified about a specific paid conference
const getPaidConferenceReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    console.log("Getting all reporters for paid conference:", conferenceId);
    
    // Get the conference to understand targeting
    const conference = await PaidConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified", "running"] }
    });

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found or not approved",
      });
    }

    // Find all reporters who should have been notified based on targeting
    let targetReporters = [];
    
    // Priority 1: Specific reporter selection
    if (conference.reporterId && conference.reporterId.length > 0) {
      targetReporters = await User.find({ 
        _id: { $in: conference.reporterId },
        role: "Reporter",
        verifiedReporter: true
      }).select("name email mobile iinsafId state city");
    }
    // Priority 2: All States flag
    else if (conference.allStates === true) {
      targetReporters = await User.find({ 
        role: "Reporter",
        verifiedReporter: true
      }).select("name email mobile iinsafId state city");
    }
    // Priority 3: Admin selected states and cities
    else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
      const query = {
        role: "Reporter",
        verifiedReporter: true,
        state: { $in: conference.adminSelectState }
      };
      
      if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
        query.city = { $in: conference.adminSelectCities };
      }
      
      targetReporters = await User.find(query).select("name email mobile iinsafId state city");
    }
    // Priority 4: Admin selected cities only
    else if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
      targetReporters = await User.find({
        role: "Reporter",
        verifiedReporter: true,
        city: { $in: conference.adminSelectCities }
      }).select("name email mobile iinsafId state city");
    }
    // Priority 5: Default behavior - match by original state and city
    else {
      targetReporters = await User.find({
        role: "Reporter",
        verifiedReporter: true,
        state: conference.state,
        city: conference.city
      }).select("name email mobile iinsafId state city");
    }

    // Get all responses for this conference (from acceptedReporters array)
    const acceptedReporters = conference.acceptedReporters || [];
    const rejectedReporters = conference.rejectedReporters || [];

    // Create a map of responses by reporter ID
    const responseMap = {};
    
    // Add accepted reporters
    acceptedReporters.forEach(reporter => {
      responseMap[reporter.reporterId.toString()] = {
        status: "accepted",
        acceptedAt: reporter.acceptedAt,
        proofSubmitted: reporter.proofSubmitted,
        proof: reporter.proof
      };
    });
    
    // Add rejected reporters
    rejectedReporters.forEach(reporter => {
      responseMap[reporter.reporterId.toString()] = {
        status: "rejected",
        rejectedAt: reporter.rejectedAt,
        rejectNote: reporter.rejectNote
      };
    });

    // Combine target reporters with their response status
    const reportersWithStatus = targetReporters.map(reporter => {
      const response = responseMap[reporter._id.toString()];
      return {
        reporterId: reporter._id,
        reporterName: reporter.name,
        reporterEmail: reporter.email,
        reporterMobile: reporter.mobile,
        iinsafId: reporter.iinsafId,
        reporterState: reporter.state,
        reporterCity: reporter.city,
        status: response ? response.status : "pending", // pending, accepted, rejected
        acceptedAt: response?.acceptedAt || null,
        rejectedAt: response?.rejectedAt || null,
        rejectNote: response?.rejectNote || null,
        proofSubmitted: response?.proofSubmitted || false,
        proof: response?.proof || null
      };
    });

    // Group by status
    const groupedReporters = {
      pending: reportersWithStatus.filter(r => r.status === "pending"),
      accepted: reportersWithStatus.filter(r => r.status === "accepted"),
      rejected: reportersWithStatus.filter(r => r.status === "rejected")
    };

    res.status(200).json({
      success: true,
      message: "Paid conference reporters fetched successfully",
      data: {
        conferenceId: conferenceId,
        totalReporters: targetReporters.length,
        pending: groupedReporters.pending.length,
        accepted: groupedReporters.accepted.length,
        rejected: groupedReporters.rejected.length,
        reporters: reportersWithStatus,
        grouped: groupedReporters
      }
    });
  } catch (error) {
    console.error("Error fetching paid conference reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching paid conference reporters",
    });
  }
};

// Delete reporter from paid conference
const deleteReporterFromPaidConference = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    
    console.log(`🗑️ Deleting reporter ${reporterId} from paid conference ${conferenceId}`);
    
    const conference = await PaidConference.findOne({ conferenceId: conferenceId });
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found",
      });
    }

    // Remove from accepted reporters
    conference.acceptedReporters = conference.acceptedReporters.filter(
      reporter => reporter.reporterId.toString() !== reporterId
    );

    // Remove from rejected reporters
    conference.rejectedReporters = conference.rejectedReporters.filter(
      reporter => reporter.reporterId.toString() !== reporterId
    );

    await conference.save();
    
    console.log(`✅ Successfully deleted reporter ${reporterId} from paid conference ${conferenceId}`);
    
    res.status(200).json({
      success: true,
      message: "Reporter removed from paid conference successfully",
      data: {
        conferenceId: conferenceId,
        reporterId: reporterId
      }
    });
    
  } catch (error) {
    console.error("Error deleting reporter from paid conference:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting reporter from paid conference",
    });
  }
};

// Get all reporters who have the paid conference in their panel (targeted reporters)
const getPaidConferenceTargetedReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    console.log(`📋 Getting all targeted reporters for paid conference ${conferenceId}`);
    
    // Find the conference
    const conference = await PaidConference.findOne({ conferenceId: conferenceId });
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Paid conference not found",
      });
    }
    
    console.log(`🔍 Conference status: ${conference.status}`);
    console.log(`🔍 Conference targeting:`, {
      allStates: conference.allStates,
      adminSelectState: conference.adminSelectState,
      adminSelectCities: conference.adminSelectCities,
      reporterId: conference.reporterId,
      originalState: conference.state,
      originalCity: conference.city
    });
    
    // Find ALL reporters who have ever been targeted for this conference
    let allTargetedReporters = new Set(); // Use Set to avoid duplicates
    
    // Get all responses to see which reporters have been targeted
    const acceptedReporters = conference.acceptedReporters || [];
    const rejectedReporters = conference.rejectedReporters || [];
    
    // Add all reporters who have responded (they were definitely targeted)
    [...acceptedReporters, ...rejectedReporters].forEach(reporter => {
      if (reporter.reporterId) {
        allTargetedReporters.add(reporter.reporterId.toString());
        console.log(`📋 Added historical reporter: ${reporter.reporterName} (${reporter.reporterId})`);
      }
    });
    
    console.log(`📋 Found ${acceptedReporters.length + rejectedReporters.length} existing responses`);
    console.log(`📋 Historical reporters count: ${allTargetedReporters.size}`);
    
    // For modified conferences, we need to show BOTH original and current targeting
    if (conference.status === "modified") {
      console.log(`🔄 Conference is MODIFIED - showing both original and current targeting`);
      
      // 1. Add ORIGINAL default targeting (state/city based)
      const originalTargetReporters = await User.find({
        role: "Reporter",
        verifiedReporter: true,
        state: conference.state,
        city: conference.city
      }).select("name email mobile iinsafId state city");
      
      originalTargetReporters.forEach(reporter => {
        allTargetedReporters.add(reporter._id.toString());
        console.log(`📍 Added ORIGINAL default reporter: ${reporter.name} (${reporter._id})`);
      });
      
      console.log(`📍 Added ${originalTargetReporters.length} original default reporters`);
      
      // 2. Add CURRENT targeting (if different from original)
      let currentTargetReporters = [];
      
      if (conference.reporterId && conference.reporterId.length > 0) {
        // Specific reporter selection
        currentTargetReporters = await User.find({
          _id: { $in: conference.reporterId },
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} currently selected reporters`);
      } else if (conference.allStates === true) {
        // All states
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🌍 Found ${currentTargetReporters.length} reporters (all states)`);
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
        
        currentTargetReporters = await User.find(query).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} reporters in selected states/cities`);
      } else if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
        // Admin selected cities
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          city: { $in: conference.adminSelectCities }
        }).select("name email mobile iinsafId state city");
        console.log(`🏙️ Found ${currentTargetReporters.length} reporters in selected cities`);
      }
      
      // Add current targeting reporters to the set
      currentTargetReporters.forEach(reporter => {
        allTargetedReporters.add(reporter._id.toString());
        console.log(`🎯 Added CURRENT targeting reporter: ${reporter.name} (${reporter._id})`);
      });
      
    } else {
      // For non-modified conferences, use normal targeting logic
      console.log(`✅ Conference is NOT modified - using normal targeting`);
      
      let currentTargetReporters = [];
      
      if (conference.reporterId && conference.reporterId.length > 0) {
        currentTargetReporters = await User.find({
          _id: { $in: conference.reporterId },
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} currently selected reporters`);
      } else if (conference.allStates === true) {
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true
        }).select("name email mobile iinsafId state city");
        console.log(`🌍 Found ${currentTargetReporters.length} reporters (all states)`);
      } else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
        const query = {
          role: "Reporter",
          verifiedReporter: true,
          state: { $in: conference.adminSelectState }
        };
        
        if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
          query.city = { $in: conference.adminSelectCities };
        }
        
        currentTargetReporters = await User.find(query).select("name email mobile iinsafId state city");
        console.log(`🎯 Found ${currentTargetReporters.length} reporters in selected states/cities`);
      } else if (conference.adminSelectCities && conference.adminSelectCities.length > 0) {
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          city: { $in: conference.adminSelectCities }
        }).select("name email mobile iinsafId state city");
        console.log(`🏙️ Found ${currentTargetReporters.length} reporters in selected cities`);
      } else {
        currentTargetReporters = await User.find({
          role: "Reporter",
          verifiedReporter: true,
          state: conference.state,
          city: conference.city
        }).select("name email mobile iinsafId state city");
        console.log(`📍 Found ${currentTargetReporters.length} reporters in original location`);
      }
      
      // Add current targeting reporters to the set
      currentTargetReporters.forEach(reporter => {
        allTargetedReporters.add(reporter._id.toString());
        console.log(`🎯 Added current reporter: ${reporter.name} (${reporter._id})`);
      });
    }
    
    // Get all unique reporter IDs
    const allReporterIds = Array.from(allTargetedReporters);
    console.log(`📊 Total unique reporters targeted: ${allReporterIds.length}`);
    console.log(`📊 All reporter IDs:`, allReporterIds);
    
    // Fetch all targeted reporters
    const targetReporters = await User.find({
      _id: { $in: allReporterIds },
      role: "Reporter",
      verifiedReporter: true
    }).select("name email mobile iinsafId state city");
    
    console.log(`✅ Final target reporters count: ${targetReporters.length}`);
    
    // Create a map of responses by reporter ID
    const responseMap = {};
    
    // Add accepted reporters
    acceptedReporters.forEach(reporter => {
      responseMap[reporter.reporterId.toString()] = {
        status: "accepted",
        acceptedAt: reporter.acceptedAt,
        proofSubmitted: reporter.proofSubmitted,
        proof: reporter.proof
      };
    });
    
    // Add rejected reporters
    rejectedReporters.forEach(reporter => {
      responseMap[reporter.reporterId.toString()] = {
        status: "rejected",
        rejectedAt: reporter.rejectedAt,
        rejectNote: reporter.rejectNote
      };
    });
    
    // Combine target reporters with their response status
    const reportersWithStatus = targetReporters.map(reporter => {
      const response = responseMap[reporter._id.toString()];
      return {
        reporterId: reporter._id,
        reporterName: reporter.name,
        reporterEmail: reporter.email,
        reporterMobile: reporter.mobile,
        iinsafId: reporter.iinsafId,
        reporterState: reporter.state,
        reporterCity: reporter.city,
        status: response ? response.status : "pending", // pending, accepted, rejected
        acceptedAt: response?.acceptedAt || null,
        rejectedAt: response?.rejectedAt || null,
        rejectNote: response?.rejectNote || null,
        proofSubmitted: response?.proofSubmitted || false,
        proof: response?.proof || null,
        hasConferenceInPanel: true // All these reporters have the conference in their panel
      };
    });
    
    // Group by status
    const groupedReporters = {
      pending: reportersWithStatus.filter(r => r.status === "pending"),
      accepted: reportersWithStatus.filter(r => r.status === "accepted"),
      rejected: reportersWithStatus.filter(r => r.status === "rejected"),
      completed: reportersWithStatus.filter(r => r.status === "completed")
    };
    
    res.status(200).json({
      success: true,
      message: "Paid conference targeted reporters fetched successfully",
      data: {
        conferenceId: conferenceId,
        totalTargetedReporters: targetReporters.length,
        pending: groupedReporters.pending.length,
        accepted: groupedReporters.accepted.length,
        rejected: groupedReporters.rejected.length,
        completed: groupedReporters.completed.length,
        reporters: reportersWithStatus,
        grouped: groupedReporters,
        targetingInfo: {
          allStates: conference.allStates,
          adminSelectState: conference.adminSelectState,
          adminSelectCities: conference.adminSelectCities,
          adminSelectPincode: conference.adminSelectPincode,
          reporterId: conference.reporterId,
          originalState: conference.state,
          originalCity: conference.city,
          modifiedAt: conference.modifiedAt
        }
      }
    });
    
  } catch (error) {
    console.error("Error fetching paid conference targeted reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching paid conference targeted reporters",
    });
  }
};

module.exports = {
  getRunningPaidConferences,
  getPaidConferenceWithReporters,
  getPaidConferenceReporters,
  deleteReporterFromPaidConference,
  getPaidConferenceTargetedReporters,
};
