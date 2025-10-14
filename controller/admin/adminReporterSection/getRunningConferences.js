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

// Delete reporter from conference - completely remove from targeting and responses
const deleteReporterFromConference = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    
    console.log(`🗑️ Deleting reporter ${reporterId} from conference ${conferenceId}`);
    console.log(`📊 Parameters - conferenceId: "${conferenceId}", reporterId: "${reporterId}"`);
    
    // Find the conference
    const FreeConference = require("../../../models/pressConference/freeConference");
    const conference = await FreeConference.findOne({ conferenceId: conferenceId });
    
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Free conference not found",
      });
    }

    let removedFromTargeted = false;
    let removedFromAccepted = false;
    let removedFromRejected = false;

    // 1. Remove from accepted reporters (ReporterConference records)
    const ReporterConference = require("../../../models/reporterConference/reporterConference");
    const mongoose = require("mongoose");
    const queryReporterId = new mongoose.Types.ObjectId(reporterId);
    
    const existingRecord = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: queryReporterId
    });
    
    if (existingRecord) {
      console.log(`📋 Found existing record with status: ${existingRecord.status}`);
      const deleteResult = await ReporterConference.deleteOne({
        conferenceId: conferenceId,
        reporterId: queryReporterId
      });
      
      if (deleteResult.deletedCount > 0) {
        if (existingRecord.status === "accepted") {
          removedFromAccepted = true;
        } else if (existingRecord.status === "rejected") {
          removedFromRejected = true;
        }
        console.log(`✅ Removed from ReporterConference with status: ${existingRecord.status}`);
      }
    } else {
      console.log(`📋 No existing ReporterConference record found`);
    }

    console.log(`📊 Response removal: Accepted=${removedFromAccepted}, Rejected=${removedFromRejected}`);

    // 2. Remove from targeting configuration
    if (conference.reporterId && conference.reporterId.length > 0) {
      // Specific reporter targeting - remove from reporterId array
      const originalTargetedCount = conference.reporterId.length;
      conference.reporterId = conference.reporterId.filter(
        id => id.toString() !== reporterId
      );
      removedFromTargeted = conference.reporterId.length < originalTargetedCount;
      console.log(`🎯 Removed from specific targeting: ${removedFromTargeted}, Original: ${originalTargetedCount}, New: ${conference.reporterId.length}`);
    } else {
      // Location-based targeting - add to exclusion list
      if (!conference.excludedReporters) {
        conference.excludedReporters = [];
      }
      
      // Check if already excluded
      const alreadyExcluded = conference.excludedReporters.some(
        id => id.toString() === reporterId
      );
      
      if (!alreadyExcluded) {
        conference.excludedReporters.push(reporterId);
        removedFromTargeted = true;
        console.log(`🚫 Added to exclusion list for location-based targeting`);
      }
    }

    // 3. Save the updated conference
    await conference.save();
    
    console.log(`✅ Successfully processed deletion for reporter ${reporterId} from conference ${conferenceId}`);
    console.log(`📊 Final status - Targeted: ${removedFromTargeted}, Accepted: ${removedFromAccepted}, Rejected: ${removedFromRejected}`);
    
    res.status(200).json({
      success: true,
      message: "Reporter completely removed from conference successfully",
      data: {
        conferenceId: conferenceId,
        reporterId: reporterId,
        removedFromTargeted: removedFromTargeted,
        removedFromAccepted: removedFromAccepted,
        removedFromRejected: removedFromRejected,
        targetingType: conference.reporterId && conference.reporterId.length > 0 ? "specific" : "location-based"
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
    
    // Show ONLY users who were actually targeted (from reporterId array)
    const User = require("../../../models/userModel/userModel");
    let allTargetedReporters = new Set(); // Use Set to avoid duplicates
    
    // Get all responses for status mapping
    const ReporterConference = require("../../../models/reporterConference/reporterConference");
    const existingResponses = await ReporterConference.find({
      conferenceId: conferenceId
    }).populate("reporterId", "name email mobile iinsafId state city");
    
    console.log(`📋 Found ${existingResponses.length} existing responses`);
    
    // Use ONLY reporterId array - no fallback to other targeting methods
    console.log(`📋 Showing ONLY users who were actually targeted (from reporterId array)`);
    
    // Get user IDs from reporterId array (these are users who were actually targeted)
    const targetedUserIds = conference.reporterId || [];
    console.log(`📋 Found ${targetedUserIds.length} users who were actually targeted:`, targetedUserIds);
    
    // Use ONLY reporterId array - no fallback
    const finalUserIds = targetedUserIds;
    
    console.log(`📋 Using ${finalUserIds.length} user IDs for display:`, finalUserIds);
    
    // Add all targeted user IDs to the set
    finalUserIds.forEach(userId => {
      allTargetedReporters.add(userId.toString());
      console.log(`🎯 Added targeted user: ${userId}`);
    });
    
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
    
    console.log(`✅ Initial target reporters count: ${targetReporters.length}`);
    
    // Filter out excluded reporters
    const excludedReporterIds = conference.excludedReporters || [];
    const filteredTargetReporters = targetReporters.filter(reporter => 
      !excludedReporterIds.some(excludedId => excludedId.toString() === reporter._id.toString())
    );
    
    console.log(`🚫 Excluded reporters: ${excludedReporterIds.length}`);
    console.log(`✅ Final filtered target reporters count: ${filteredTargetReporters.length}`);
    
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
    
    // Combine target reporters with their response status (excluding removed reporters)
    const reportersWithStatus = filteredTargetReporters.map(reporter => {
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
        totalTargetedReporters: filteredTargetReporters.length,
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
          excludedReporters: conference.excludedReporters,
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
