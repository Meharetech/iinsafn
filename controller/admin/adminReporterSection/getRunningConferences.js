const FreeConference = require("../../../models/pressConference/freeConference");
const ReporterConference = require("../../../models/reporterConference/reporterConference");
const User = require("../../../models/userModel/userModel");

const getRunningConferences = async (req, res) => {
  try {
    console.log("Getting running conferences...");
    console.log("Admin user:", req.admin);
    
    // Get all approved and modified conferences (running conferences)
    const approvedConferences = await FreeConference.find({ 
      status: { $in: ["approved", "modified"] }
    }).populate("submittedBy", "name email organization pressConferenceId");
    
    console.log("Found approved and modified conferences:", approvedConferences.length);

    // Get all accepted reporter conferences
    const acceptedReporterConferences = await ReporterConference.find({
      status: "accepted"
    }).populate("reporterId", "name email iinsafId state city");

    // Group accepted conferences by conferenceId
    const acceptedByConference = {};
    acceptedReporterConferences.forEach(repConf => {
      if (!acceptedByConference[repConf.conferenceId]) {
        acceptedByConference[repConf.conferenceId] = [];
      }
      acceptedByConference[repConf.conferenceId].push(repConf);
    });

    // Merge conference data with accepted reporters
    const runningConferences = approvedConferences.map(conference => {
      const acceptedReporters = acceptedByConference[conference.conferenceId] || [];
      const conferenceObject = conference.toObject();
      
      // Add admin targeting information for modified conferences
      if (conferenceObject.status === "modified") {
        conferenceObject.adminTargeting = {
          allStates: conferenceObject.allStates,
          adminSelectState: conferenceObject.adminSelectState,
          adminSelectCities: conferenceObject.adminSelectCities,
          adminSelectPincode: conferenceObject.adminSelectPincode,
          reporterId: conferenceObject.reporterId,
          modifiedAt: conferenceObject.modifiedAt
        };
      }
      
      return {
        ...conferenceObject,
        acceptedReporters: acceptedReporters.map(repConf => ({
          reporterId: repConf.reporterId._id,
          reporterName: repConf.reporterId.name,
          reporterEmail: repConf.reporterId.email,
          iinsafId: repConf.iinsafId,
          reporterState: repConf.reporterId.state,
          reporterCity: repConf.reporterId.city,
          acceptedAt: repConf.acceptedAt,
          proofSubmitted: repConf.proofSubmitted,
          proofDetails: repConf.proofDetails
        })),
        totalAccepted: acceptedReporters.length,
        totalProofSubmitted: acceptedReporters.filter(rep => rep.proofSubmitted).length
      };
    });

    // Filter out conferences with no accepted reporters (optional)
    const conferencesWithAcceptances = runningConferences.filter(conf => conf.totalAccepted > 0);
    
    console.log("Conferences with acceptances:", conferencesWithAcceptances.length);
    console.log("Sample conference:", conferencesWithAcceptances[0]);

    res.status(200).json({
      success: true,
      message: "Running conferences with accepted reporters fetched successfully",
      data: conferencesWithAcceptances,
      totalConferences: conferencesWithAcceptances.length,
      totalAcceptedReporters: acceptedReporterConferences.length
    });
  } catch (error) {
    console.error("Error fetching running conferences:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching running conferences",
    });
  }
};

// Get specific conference with all accepted reporters
const getConferenceWithReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    const conference = await FreeConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified"] }
    }).populate("submittedBy", "name email organization pressConferenceId");

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
      });
    }

    // Get all accepted reporters for this conference
    const acceptedReporters = await ReporterConference.find({
      conferenceId: conferenceId,
      status: "accepted"
    }).populate("reporterId", "name email iinsafId state city mobile");

    const conferenceObject = conference.toObject();
    
    // Add admin targeting information for modified conferences
    if (conferenceObject.status === "modified") {
      console.log("🔍 Backend Debug - Conference is modified");
      console.log("🔍 Backend Debug - conferenceObject.modifiedAt:", conferenceObject.modifiedAt);
      console.log("🔍 Backend Debug - conferenceObject.modifiedAt type:", typeof conferenceObject.modifiedAt);
      
      conferenceObject.adminTargeting = {
        allStates: conferenceObject.allStates,
        adminSelectState: conferenceObject.adminSelectState,
        adminSelectCities: conferenceObject.adminSelectCities,
        adminSelectPincode: conferenceObject.adminSelectPincode,
        reporterId: conferenceObject.reporterId,
        modifiedAt: conferenceObject.modifiedAt
      };
      
      console.log("🔍 Backend Debug - adminTargeting.modifiedAt:", conferenceObject.adminTargeting.modifiedAt);
    } else {
      console.log("🔍 Backend Debug - Conference is NOT modified, status:", conferenceObject.status);
    }
    
    // Ensure modifiedAt is always available for frontend display
    if (!conferenceObject.modifiedAt) {
      conferenceObject.modifiedAt = null;
    }

    const conferenceWithReporters = {
      ...conferenceObject,
      acceptedReporters: acceptedReporters.map(repConf => ({
        reporterId: repConf.reporterId._id,
        reporterName: repConf.reporterId.name,
        reporterEmail: repConf.reporterId.email,
        reporterMobile: repConf.reporterId.mobile,
        iinsafId: repConf.iinsafId,
        reporterState: repConf.reporterId.state,
        reporterCity: repConf.reporterId.city,
        acceptedAt: repConf.acceptedAt,
        proofSubmitted: repConf.proofSubmitted,
        proofDetails: repConf.proofDetails
      })),
      totalAccepted: acceptedReporters.length,
      totalProofSubmitted: acceptedReporters.filter(rep => rep.proofSubmitted).length
    };

    res.status(200).json({
      success: true,
      message: "Conference with accepted reporters fetched successfully",
      data: conferenceWithReporters,
    });
  } catch (error) {
    console.error("Error fetching conference with reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conference with reporters",
    });
  }
};

// Get all reporters who were notified about a specific conference
const getConferenceReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    console.log("Getting all reporters for conference:", conferenceId);
    
    // Get the conference to understand targeting
    const conference = await FreeConference.findOne({ 
      conferenceId: conferenceId,
      status: { $in: ["approved", "modified"] }
    });

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found or not approved",
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

    // Get all responses for this conference
    const allResponses = await ReporterConference.find({
      conferenceId: conferenceId
    }).populate("reporterId", "name email mobile iinsafId state city");

    // Create a map of responses by reporter ID
    const responseMap = {};
    allResponses.forEach(response => {
      responseMap[response.reporterId._id.toString()] = {
        status: response.status,
        acceptedAt: response.acceptedAt,
        rejectedAt: response.rejectedAt,
        rejectNote: response.rejectNote,
        proofSubmitted: response.proofSubmitted,
        proofDetails: response.proofDetails
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
        proofDetails: response?.proofDetails || null
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
      message: "Conference reporters fetched successfully",
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
    console.error("Error fetching conference reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conference reporters",
    });
  }
};

// Delete reporter from conference
const deleteReporterFromConference = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    
    console.log(`🗑️ Deleting reporter ${reporterId} from conference ${conferenceId}`);
    console.log(`📊 Parameters - conferenceId: "${conferenceId}", reporterId: "${reporterId}"`);
    
    // Find and delete the reporter conference record
    const ReporterConference = require("../../../models/reporterConference/reporterConference");
    
    // First, let's check if the record exists
    const mongoose = require("mongoose");
    const queryReporterId = new mongoose.Types.ObjectId(reporterId);
    
    const existingRecord = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: queryReporterId
    });
    
    console.log(`🔍 Existing record found:`, existingRecord ? "YES" : "NO");
    if (existingRecord) {
      console.log(`📋 Record details:`, {
        _id: existingRecord._id,
        conferenceId: existingRecord.conferenceId,
        reporterId: existingRecord.reporterId,
        status: existingRecord.status
      });
    } else {
      // Check if this reporter was even targeted for this conference
      const FreeConference = require("../../../models/pressConference/freeConference");
      const conference = await FreeConference.findOne({ conferenceId: conferenceId });
      
      if (!conference) {
        return res.status(404).json({
          success: false,
          message: "Conference not found",
        });
      }
      
      // Check if reporter was targeted
      let isTargeted = false;
      
      if (conference.reporterId && conference.reporterId.length > 0) {
        isTargeted = conference.reporterId.some(id => id.toString() === reporterId);
      } else if (conference.allStates === true) {
        isTargeted = true;
      } else if (conference.adminSelectState && conference.adminSelectState.length > 0) {
        // Check if reporter's state matches
        const User = require("../../../models/userModel/userModel");
        const reporter = await User.findById(reporterId);
        if (reporter) {
          isTargeted = conference.adminSelectState.includes(reporter.state);
        }
      }
      
      if (!isTargeted) {
        return res.status(404).json({
          success: false,
          message: "This reporter was not targeted for this conference",
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "This reporter has not responded to the conference yet. Only reporters who have accepted or rejected can be removed.",
      });
    }
    
    // Delete the existing record
    let deleteResult;
    
    try {
      deleteResult = await ReporterConference.deleteOne({
        conferenceId: conferenceId,
        reporterId: queryReporterId
      });
      
      console.log(`🔍 Delete result: deletedCount = ${deleteResult.deletedCount}`);
      
    } catch (deleteError) {
      console.error(`❌ Delete error:`, deleteError);
      return res.status(500).json({
        success: false,
        message: "Error during deletion process",
      });
    }
    
    if (deleteResult.deletedCount === 0) {
      // Let's also check what records exist for this conference
      const allRecordsForConference = await ReporterConference.find({ conferenceId: conferenceId });
      console.log(`📊 All records for conference ${conferenceId}:`, allRecordsForConference.map(r => ({
        reporterId: r.reporterId,
        reporterIdType: typeof r.reporterId,
        status: r.status
      })));
      
      return res.status(404).json({
        success: false,
        message: "Reporter not found in this conference",
      });
    }
    
    console.log(`✅ Successfully deleted reporter ${reporterId} from conference ${conferenceId}`);
    
    res.status(200).json({
      success: true,
      message: "Reporter removed from conference successfully",
      data: {
        conferenceId: conferenceId,
        reporterId: reporterId,
        deletedCount: deleteResult.deletedCount
      }
    });
    
  } catch (error) {
    console.error("Error deleting reporter from conference:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting reporter from conference",
    });
  }
};

// Get all reporters who have the conference in their panel (targeted reporters)
const getConferenceTargetedReporters = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    console.log(`📋 Getting all targeted reporters for conference ${conferenceId}`);
    
    // Find the conference
    const FreeConference = require("../../../models/pressConference/freeConference");
    const conference = await FreeConference.findOne({ conferenceId: conferenceId });
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
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
    const User = require("../../../models/userModel/userModel");
    let allTargetedReporters = new Set(); // Use Set to avoid duplicates
    
    // Get all responses to see which reporters have been targeted
    const ReporterConference = require("../../../models/reporterConference/reporterConference");
    const existingResponses = await ReporterConference.find({
      conferenceId: conferenceId
    }).populate("reporterId", "name email mobile iinsafId state city");
    
    // Add all reporters who have responded (they were definitely targeted)
    existingResponses.forEach(response => {
      if (response.reporterId) {
        allTargetedReporters.add(response.reporterId._id.toString());
        console.log(`📋 Added historical reporter: ${response.reporterId.name} (${response.reporterId._id})`);
      }
    });
    
    console.log(`📋 Found ${existingResponses.length} existing responses`);
    console.log(`📋 Historical reporters count: ${allTargetedReporters.size}`);
    
    // CRITICAL FIX: For modified conferences, we need to show BOTH original and current targeting
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
    
    // Get all responses for this conference (already fetched above)
    const allResponses = existingResponses;
    
    // Create a map of responses by reporter ID
    const responseMap = {};
    allResponses.forEach(response => {
      responseMap[response.reporterId._id.toString()] = {
        status: response.status,
        acceptedAt: response.acceptedAt,
        rejectedAt: response.rejectedAt,
        rejectNote: response.rejectNote,
        proofSubmitted: response.proofSubmitted,
        proofDetails: response.proofDetails
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
        proofDetails: response?.proofDetails || null,
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
      message: "Conference targeted reporters fetched successfully",
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
    console.error("Error fetching conference targeted reporters:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching conference targeted reporters",
    });
  }
};

module.exports = {
  getRunningConferences,
  getConferenceWithReporters,
  getConferenceReporters,
  deleteReporterFromConference,
  getConferenceTargetedReporters,
};
