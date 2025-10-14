const FreeConference = require("../../models/pressConference/freeConference");
const PressConferenceUser = require("../../models/pressConferenceUser/pressConferenceUser");
const notifyMatchingReporters = require("../../utils/notifyMatchingReporters");

// Submit free conference
const submitFreeConference = async (req, res) => {
  try {
    console.log("Free conference submission request received:", req.body);
    console.log("User from middleware:", req.user);
    
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
    } = req.body;

    // Get user from authenticated request (middleware should have set this)
    const userId = req.user?._id;
    console.log("User ID from request:", userId);
    
    if (!userId) {
      console.log("No user ID found in request");
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    // Validate required fields
    const requiredFields = [
      "topic",
      "purpose", 
      "conferenceDate",
      "conferenceTime",
      "timePeriod",
      "state",
      "city",
      "place",
      "landmark",
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate purpose word count (minimum 10 words)
    const wordCount = purpose.trim().split(/\s+/).length;
    if (wordCount < 10) {
      return res.status(400).json({
        success: false,
        message: "Purpose must be at least 10 words",
      });
    }

    // Create new free conference
    const freeConference = new FreeConference({
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
      status: "pending",
    });

    await freeConference.save();

    return res.status(201).json({
      success: true,
      message: "Free conference submitted successfully",
      data: {
        conferenceId: freeConference.conferenceId,
        status: freeConference.status,
        submittedAt: freeConference.submittedAt,
      },
    });

  } catch (error) {
    console.error("Error submitting free conference:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Get all free conferences (for admin)
const getAllFreeConferences = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, date, search } = req.query;
    
    console.log("Admin request - Status:", status, "Date:", date, "Search:", search);
    
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Add date filter
    if (date) {
      // Filter by conference date (not submission date)
      filter.conferenceDate = date;
      console.log("Date filter applied:", filter.conferenceDate);
    }

    // Add search filter
    if (search) {
      filter.$or = [
        { topic: { $regex: search, $options: 'i' } },
        { conferenceId: { $regex: search, $options: 'i' } }
      ];
      console.log("Search filter applied:", filter.$or);
    }

    const conferences = await FreeConference.find(filter)
      .populate("submittedBy", "name email organization pressConferenceId")
      .populate("adminAction.modifiedBy", "name email")
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log("Filter used:", filter);
    console.log("Found conferences:", conferences.length);
    conferences.forEach(conf => {
      console.log(`Conference ${conf.conferenceId}: date=${conf.conferenceDate}, status=${conf.status}`);
    });

    // Add reporter details for approved, modified, and completed conferences
    const conferencesWithReporterDetails = await Promise.all(
      conferences.map(async (conference) => {
        const conferenceObject = conference.toObject();

        // Add admin targeting information for modified conferences
        if (conferenceObject.status === "modified") {
          conferenceObject.adminTargeting = {
            allStates: conferenceObject.allStates,
            adminSelectState: conferenceObject.adminSelectState,
            adminSelectCities: conferenceObject.adminSelectCities,
            adminSelectPincode: conferenceObject.adminSelectPincode,
            reporterId: conferenceObject.reporterId
          };
        }

        if (conferenceObject.status === "approved" || conferenceObject.status === "modified" || conferenceObject.status === "completed") {
          try {
            const ReporterConference = require("../../models/reporterConference/reporterConference");
            const User = require("../../models/userModel/userModel");

            // Get ALL reporters for this conference (including pending ones)
            const allReporters = await ReporterConference.find({
              conferenceId: conferenceObject.conferenceId
            }).select("reporterId iinsafId status proofSubmitted acceptedAt completedAt rejectedAt rejectNote proofDetails.videoLink proofDetails.channelName proofDetails.platform proofDetails.duration proofDetails.screenshot proofDetails.submittedAt proofDetails.rejectedAt proofDetails.rejectReason proofDetails.adminRejectNote");

            // Separate reporters by status
            const acceptedReporters = allReporters.filter(r => r.status === "accepted" || r.status === "completed");
            const pendingReporters = allReporters.filter(r => r.status === "pending");
            const rejectedReporters = allReporters.filter(r => r.status === "rejected");

            const reporterDetails = await Promise.all(
              allReporters.map(async (reporter) => {
                const user = await User.findById(reporter.reporterId).select("name email state city");
                return {
                  ...reporter.toObject(),
                  reporterName: user ? user.name : "N/A",
                  reporterEmail: user ? user.email : "N/A",
                  reporterState: user ? user.state : "N/A",
                  reporterCity: user ? user.city : "N/A",
                };
              })
            );

            const totalProofSubmitted = reporterDetails.filter(
              (r) => r.proofSubmitted && r.status === "completed"
            ).length;
            const totalProofPending = reporterDetails.filter(
              (r) => !r.proofSubmitted || r.status === "accepted"
            ).length;

            // Calculate total targeted users (all users who should have this conference in their panel)
            let totalTargetedUsers = 0;
            try {
              // Find ALL reporters who should be targeted for this conference
              let allTargetedReporters = new Set();
              
              // Add all reporters who have responded (they were definitely targeted)
              allReporters.forEach(reporter => {
                allTargetedReporters.add(reporter.reporterId.toString());
              });
              
              // For modified conferences, we need to show BOTH original and current targeting
              if (conferenceObject.status === "modified") {
                // Add ORIGINAL default targeting (state/city based)
                const originalTargetReporters = await User.find({
                  role: "Reporter",
                  verifiedReporter: true,
                  state: conferenceObject.state,
                  city: conferenceObject.city
                }).select("_id");
                
                originalTargetReporters.forEach(reporter => {
                  allTargetedReporters.add(reporter._id.toString());
                });
                
                // Add CURRENT targeting (if different from original)
                let currentTargetReporters = [];
                
                if (conferenceObject.reporterId && conferenceObject.reporterId.length > 0) {
                  // Specific reporter selection
                  currentTargetReporters = await User.find({
                    _id: { $in: conferenceObject.reporterId },
                    role: "Reporter",
                    verifiedReporter: true
                  }).select("_id");
                } else if (conferenceObject.allStates === true) {
                  // All states
                  currentTargetReporters = await User.find({
                    role: "Reporter",
                    verifiedReporter: true
                  }).select("_id");
                } else if (conferenceObject.adminSelectState && conferenceObject.adminSelectState.length > 0) {
                  // Admin selected states
                  const query = {
                    role: "Reporter",
                    verifiedReporter: true,
                    state: { $in: conferenceObject.adminSelectState }
                  };
                  
                  if (conferenceObject.adminSelectCities && conferenceObject.adminSelectCities.length > 0) {
                    query.city = { $in: conferenceObject.adminSelectCities };
                  }
                  
                  currentTargetReporters = await User.find(query).select("_id");
                } else if (conferenceObject.adminSelectCities && conferenceObject.adminSelectCities.length > 0) {
                  // Admin selected cities
                  currentTargetReporters = await User.find({
                    role: "Reporter",
                    verifiedReporter: true,
                    city: { $in: conferenceObject.adminSelectCities }
                  }).select("_id");
                }
                
                // Add current targeting reporters to the set
                currentTargetReporters.forEach(reporter => {
                  allTargetedReporters.add(reporter._id.toString());
                });
              } else {
                // For non-modified conferences, use normal targeting logic
                let currentTargetReporters = [];
                
                if (conferenceObject.reporterId && conferenceObject.reporterId.length > 0) {
                  currentTargetReporters = await User.find({
                    _id: { $in: conferenceObject.reporterId },
                    role: "Reporter",
                    verifiedReporter: true
                  }).select("_id");
                } else if (conferenceObject.allStates === true) {
                  currentTargetReporters = await User.find({
                    role: "Reporter",
                    verifiedReporter: true
                  }).select("_id");
                } else if (conferenceObject.adminSelectState && conferenceObject.adminSelectState.length > 0) {
                  const query = {
                    role: "Reporter",
                    verifiedReporter: true,
                    state: { $in: conferenceObject.adminSelectState }
                  };
                  
                  if (conferenceObject.adminSelectCities && conferenceObject.adminSelectCities.length > 0) {
                    query.city = { $in: conferenceObject.adminSelectCities };
                  }
                  
                  currentTargetReporters = await User.find(query).select("_id");
                } else if (conferenceObject.adminSelectCities && conferenceObject.adminSelectCities.length > 0) {
                  currentTargetReporters = await User.find({
                    role: "Reporter",
                    verifiedReporter: true,
                    city: { $in: conferenceObject.adminSelectCities }
                  }).select("_id");
                } else {
                  currentTargetReporters = await User.find({
                    role: "Reporter",
                    verifiedReporter: true,
                    state: conferenceObject.state,
                    city: conferenceObject.city
                  }).select("_id");
                }
                
                // Add current targeting reporters to the set
                currentTargetReporters.forEach(reporter => {
                  allTargetedReporters.add(reporter._id.toString());
                });
              }
              
              // Filter out excluded reporters
              const excludedReporterIds = conferenceObject.excludedReporters || [];
              const filteredTargetedReporters = Array.from(allTargetedReporters).filter(reporterId => 
                !excludedReporterIds.some(excludedId => excludedId.toString() === reporterId)
              );
              
              totalTargetedUsers = filteredTargetedReporters.length;
            } catch (targetingError) {
              console.error("Error calculating total targeted users:", targetingError);
              // Fallback to current logic
              totalTargetedUsers = reporterDetails.length;
            }

            return {
              ...conferenceObject,
              allReporters: reporterDetails,
              acceptedReporters: reporterDetails.filter(r => r.status === "accepted" || r.status === "completed"),
              pendingReporters: reporterDetails.filter(r => r.status === "pending"),
              rejectedReporters: reporterDetails.filter(r => r.status === "rejected"),
              totalReporters: totalTargetedUsers, // Total targeted users (all users in panel)
              totalRespondedReporters: reporterDetails.length, // Total who responded
              totalAcceptedReporters: acceptedReporters.length,
              totalPendingReporters: pendingReporters.length,
              totalRejectedReporters: rejectedReporters.length,
              totalProofSubmitted: totalProofSubmitted,
              totalProofPending: totalProofPending,
            };
          } catch (reporterError) {
            console.error("Error fetching reporter details:", reporterError);
            return conferenceObject;
          }
        }

        return conferenceObject;
      })
    );

    const total = await FreeConference.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        conferences: conferencesWithReporterDetails,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });

  } catch (error) {
    console.error("Error fetching free conferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Get single free conference
const getFreeConferenceById = async (req, res) => {
  try {
    const { id } = req.params;

    const conference = await FreeConference.findOne({ conferenceId: id })
      .populate("submittedBy", "name email organization pressConferenceId")
      .populate("adminAction.modifiedBy", "name email");

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: conference,
    });

  } catch (error) {
    console.error("Error fetching free conference:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Admin actions: Approve, Reject, Modify
const adminAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      action, 
      note, 
      selectedStates, 
      adminSelectCities, 
      adminSelectPincode, 
      reporterId, 
      allStates 
    } = req.body;

    if (!["approved", "rejected", "modified"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be approved, rejected, or modified",
      });
    }

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Admin note is required for this action",
      });
    }

    const conference = await FreeConference.findOne({ conferenceId: id });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
      });
    }

    // Update conference status and admin action
    conference.status = action;
    conference.adminAction = {
      action,
      note: note.trim(),
      modifiedBy: req.admin?.id, // Assuming admin is available in request
      actionDate: new Date(),
    };

    // Set rejection fields if action is rejected
    if (action === "rejected") {
      conference.rejectReason = note.trim();
      conference.rejectedAt = new Date();
      console.log(`Setting rejection fields for conference ${conference.conferenceId}: rejectReason="${note.trim()}", rejectedAt=${new Date()}`);
    }

    // If action is approved or modified, add targeting configuration for reporter matching
    if (action === "approved" || action === "modified") {
      // Set all states flag
      if (allStates !== undefined) {
        conference.allStates = allStates;
        console.log(`Conference ${conference.conferenceId} allStates set to:`, allStates);
      }
      
      // Set selected states
      if (selectedStates && selectedStates.length > 0) {
        conference.adminSelectState = selectedStates;
        console.log(`Conference ${conference.conferenceId} modified with selected states:`, selectedStates);
      }
      
      // Set selected cities
      if (adminSelectCities && adminSelectCities.length > 0) {
        conference.adminSelectCities = adminSelectCities;
        console.log(`Conference ${conference.conferenceId} modified with selected cities:`, adminSelectCities);
      }
      
      // Set selected pincode
      if (adminSelectPincode) {
        conference.adminSelectPincode = adminSelectPincode;
        console.log(`Conference ${conference.conferenceId} modified with pincode:`, adminSelectPincode);
      }
      
      // Set selected reporters
      if (reporterId && reporterId.length > 0) {
        conference.reporterId = reporterId;
        console.log(`Conference ${conference.conferenceId} modified with selected reporters:`, reporterId);
      }

      // Add modification timestamp for tracking
      if (action === "modified") {
        conference.modifiedAt = new Date();
        console.log(`Conference ${conference.conferenceId} marked as modified at:`, conference.modifiedAt);
      }
    }

    await conference.save();
    console.log(`Conference ${conference.conferenceId} saved with status: ${conference.status}`);
    console.log(`Targeting configuration:`, {
      allStates: conference.allStates,
      adminSelectState: conference.adminSelectState,
      adminSelectCities: conference.adminSelectCities,
      adminSelectPincode: conference.adminSelectPincode,
      reporterId: conference.reporterId
    });
    if (action === "rejected") {
      console.log(`Saved rejection details - rejectReason: "${conference.rejectReason}", rejectedAt: ${conference.rejectedAt}`);
    }

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

    // Send notifications to reporters only when admin approves or modifies
    if (action === "approved" || action === "modified") {
      try {
        console.log(`🔔 Sending notifications to reporters for conference ${conference.conferenceId}`);
        
        // Prepare conference data for notification
        const conferenceForNotification = {
          _id: conference._id,
          conferenceId: conference.conferenceId,
          topic: conference.topic,
          purpose: conference.purpose,
          conferenceDate: conference.conferenceDate,
          conferenceTime: conference.conferenceTime,
          timePeriod: conference.timePeriod,
          state: conference.state,
          city: conference.city,
          place: conference.place,
          landmark: conference.landmark,
          // Admin targeting configuration
          allStates: conference.allStates,
          adminSelectState: conference.adminSelectState,
          adminSelectCities: conference.adminSelectCities,
          adminSelectPincode: conference.adminSelectPincode,
          reporterId: conference.reporterId,
          status: conference.status,
          type: "free-conference"
        };

        await notifyMatchingReporters(conferenceForNotification);
        console.log(`✅ Notifications sent successfully for conference ${conference.conferenceId}`);
      } catch (notificationError) {
        console.error(`❌ Error sending notifications for conference ${conference.conferenceId}:`, notificationError);
        // Don't fail the request if notification fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `Conference ${action} successfully`,
      data: {
        conferenceId: conference.conferenceId,
        status: conference.status,
        actionDate: conference.adminAction.actionDate,
      },
    });

  } catch (error) {
    console.error("Error updating conference:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Get user's submitted conferences
const getUserConferences = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const conferences = await FreeConference.find({ submittedBy: userId })
      .sort({ submittedAt: -1 });

    // For running and completed conferences, fetch reporter details
    const conferencesWithReporterDetails = await Promise.all(
      conferences.map(async (conference) => {
        const conferenceObject = conference.toObject();

        // Add admin targeting information for modified conferences
        if (conferenceObject.status === "modified") {
          conferenceObject.adminTargeting = {
            allStates: conferenceObject.allStates,
            adminSelectState: conferenceObject.adminSelectState,
            adminSelectCities: conferenceObject.adminSelectCities,
            adminSelectPincode: conferenceObject.adminSelectPincode,
            reporterId: conferenceObject.reporterId
          };
        }

        if (conferenceObject.status === "approved" || conferenceObject.status === "modified" || conferenceObject.status === "completed") {
          try {
            const ReporterConference = require("../../models/reporterConference/reporterConference");
            const User = require("../../models/userModel/userModel");

            const acceptedReporters = await ReporterConference.find({
              conferenceId: conferenceObject.conferenceId,
              status: { $in: ["accepted", "completed"] }
            }).select("reporterId iinsafId status proofSubmitted acceptedAt completedAt proofDetails.videoLink proofDetails.channelName proofDetails.platform proofDetails.duration proofDetails.screenshot proofDetails.submittedAt proofDetails.rejectedAt proofDetails.rejectReason proofDetails.adminRejectNote");


            const reporterDetails = await Promise.all(
              acceptedReporters.map(async (reporter) => {
                const user = await User.findById(reporter.reporterId).select("name email state city");
                return {
                  ...reporter.toObject(),
                  reporterName: user ? user.name : "N/A",
                  reporterEmail: user ? user.email : "N/A",
                  reporterState: user ? user.state : "N/A",
                  reporterCity: user ? user.city : "N/A",
                };
              })
            );

            const totalProofSubmitted = reporterDetails.filter(
              (r) => r.proofSubmitted && r.status === "completed"
            ).length;
            const totalProofPending = reporterDetails.filter(
              (r) => !r.proofSubmitted || r.status === "accepted"
            ).length;

            return {
              ...conferenceObject,
              acceptedReporters: reporterDetails,
              totalAcceptedReporters: reporterDetails.length,
              totalProofSubmitted: totalProofSubmitted,
              totalProofPending: totalProofPending,
            };
          } catch (reporterError) {
            console.error("Error fetching reporter details:", reporterError);
            return conferenceObject;
          }
        } else if (conferenceObject.status === "completed") {
          try {
            const ReporterConference = require("../../models/reporterConference/reporterConference");
            const User = require("../../models/userModel/userModel");

            const completedReporters = await ReporterConference.find({
              conferenceId: conferenceObject.conferenceId,
              status: "completed"
            }).select("reporterId iinsafId status proofSubmitted acceptedAt completedAt proofDetails.videoLink proofDetails.channelName proofDetails.platform proofDetails.duration proofDetails.screenshot proofDetails.submittedAt proofDetails.rejectedAt proofDetails.rejectReason proofDetails.adminRejectNote");

            const reporterDetails = await Promise.all(
              completedReporters.map(async (reporter) => {
                const user = await User.findById(reporter.reporterId).select("name email state city");
                return {
                  ...reporter.toObject(),
                  reporterName: user ? user.name : "N/A",
                  reporterEmail: user ? user.email : "N/A",
                  reporterState: user ? user.state : "N/A",
                  reporterCity: user ? user.city : "N/A",
                };
              })
            );

            return {
              ...conferenceObject,
              completedReporters: reporterDetails,
              totalCompletedReporters: reporterDetails.length,
            };
          } catch (reporterError) {
            console.error("Error fetching completed reporter details:", reporterError);
            return conferenceObject;
          }
        }

        return conferenceObject;
      })
    );

    return res.status(200).json({
      success: true,
      data: conferencesWithReporterDetails,
    });

  } catch (error) {
    console.error("Error fetching user conferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Mark conference as completed when all proofs are approved
const markConferenceCompleted = async (req, res) => {
  try {
    const { conferenceId } = req.params;

    const conference = await FreeConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
      });
    }

    // Check if all targeted reporters have responded and all accepted reporters have completed their work
    const ReporterConference = require("../../models/reporterConference/reporterConference");
    const User = require("../../models/userModel/userModel");
    
    // Get all reporters who have responded to this conference (accepted or rejected)
    const allRespondedReporters = await ReporterConference.find({
      conferenceId: conferenceId,
      status: { $in: ["accepted", "rejected", "completed"] }
    });

    // Get all targeted reporters for this conference
    let totalTargetedReporters = 0;
    
    if (conference.reporterId && conference.reporterId.length > 0) {
      // Specific reporter targeting
      totalTargetedReporters = conference.reporterId.length;
    } else if (conference.allStates === true) {
      // All states targeting
      totalTargetedReporters = await User.countDocuments({
        role: "Reporter",
        verifiedReporter: true
      });
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
      
      totalTargetedReporters = await User.countDocuments(query);
    } else {
      // Default location-based targeting
      totalTargetedReporters = await User.countDocuments({
        role: "Reporter",
        verifiedReporter: true,
        state: conference.state,
        city: conference.city
      });
    }

    console.log(`Manual completion check for conference ${conferenceId}:`, {
      totalTargetedReporters,
      respondedReporters: allRespondedReporters.length,
      allResponded: allRespondedReporters.map(r => ({ 
        reporterId: r.reporterId, 
        status: r.status 
      }))
    });

    // Only mark as completed when ALL targeted reporters have responded
    if (totalTargetedReporters > 0 && allRespondedReporters.length >= totalTargetedReporters) {
      // Check if all accepted reporters have completed their work
      const acceptedReporters = await ReporterConference.find({
        conferenceId: conferenceId,
        status: { $in: ["accepted", "completed"] }
      });

      const completedReporters = await ReporterConference.find({
        conferenceId: conferenceId,
        status: "completed"
      });

      // Mark as completed only if all accepted reporters have completed their work
      if (acceptedReporters.length > 0 && acceptedReporters.length === completedReporters.length) {
        conference.status = "completed";
        conference.completedAt = new Date();
        await conference.save();

        return res.status(200).json({
          success: true,
          message: "Conference marked as completed - all targeted reporters responded and all accepted reporters completed their work",
          data: {
            conferenceId: conference.conferenceId,
            status: conference.status,
            completedAt: conference.completedAt,
            totalTargetedReporters,
            respondedReporters: allRespondedReporters.length,
            acceptedReporters: acceptedReporters.length,
            completedReporters: completedReporters.length
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Cannot mark as completed. ${acceptedReporters.length - completedReporters.length} accepted reporters haven't completed their work yet.`,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: `Cannot mark as completed. Only ${allRespondedReporters.length} out of ${totalTargetedReporters} targeted reporters have responded.`,
      });
    }
  } catch (error) {
    console.error("Error marking conference as completed:", error);
    res.status(500).json({
      success: false,
      message: "Server error while marking conference as completed",
    });
  }
};

// Test endpoint to debug conference data
const testConferenceData = async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    const conference = await FreeConference.findOne({ conferenceId });
    if (!conference) {
      return res.status(404).json({
        success: false,
        message: "Conference not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        conferenceId: conference.conferenceId,
        status: conference.status,
        state: conference.state,
        city: conference.city,
        adminSelectState: conference.adminSelectState,
        adminAction: conference.adminAction,
        topic: conference.topic,
        purpose: conference.purpose,
      },
    });
  } catch (error) {
    console.error("Error in testConferenceData:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get completed conferences from ReporterConference collection
const getCompletedConferences = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search filter
    let searchFilter = {};
    if (search.trim()) {
      searchFilter = {
        $or: [
          { conferenceId: { $regex: search, $options: "i" } },
          { iinsafId: { $regex: search, $options: "i" } },
          { "conferenceDetails.topic": { $regex: search, $options: "i" } },
          { "conferenceDetails.state": { $regex: search, $options: "i" } },
          { "conferenceDetails.city": { $regex: search, $options: "i" } },
          { "conferenceDetails.submittedBy.name": { $regex: search, $options: "i" } },
          { "proofDetails.channelName": { $regex: search, $options: "i" } },
        ],
      };
    }

    // Fetch completed conferences from ReporterConference collection
    const ReporterConference = require("../../models/reporterConference/reporterConference");
    const User = require("../../models/userModel/userModel");

    const completedConferences = await ReporterConference.find({
      status: "completed",
      ...searchFilter,
    })
      .populate("reporterId", "name email state city")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await ReporterConference.countDocuments({
      status: "completed",
      ...searchFilter,
    });

    // Group conferences by conferenceId to show unique conferences
    const conferenceMap = new Map();
    
    completedConferences.forEach((reporterConference) => {
      const conferenceId = reporterConference.conferenceId;
      
      if (!conferenceMap.has(conferenceId)) {
        // Create conference object with first reporter's details
        const conference = {
          _id: reporterConference._id,
          conferenceId: conferenceId,
          topic: reporterConference.conferenceDetails.topic,
          purpose: reporterConference.conferenceDetails.purpose,
          conferenceDate: reporterConference.conferenceDetails.conferenceDate,
          conferenceTime: reporterConference.conferenceDetails.conferenceTime,
          timePeriod: reporterConference.conferenceDetails.timePeriod,
          state: reporterConference.conferenceDetails.state,
          city: reporterConference.conferenceDetails.city,
          place: reporterConference.conferenceDetails.place,
          landmark: reporterConference.conferenceDetails.landmark,
          adminNote: reporterConference.conferenceDetails.adminNote,
          submittedBy: reporterConference.conferenceDetails.submittedBy,
          status: "completed",
          completedAt: reporterConference.completedAt,
          completedReporters: [],
          totalReporters: 0, // Will be updated later
          totalCompletedReporters: 0, // Will be updated later
          totalPendingReporters: 0, // Will be updated later
          pendingReporters: [], // Will be populated later
        };
        conferenceMap.set(conferenceId, conference);
      }
      
      // Add reporter details to the conference
      const conference = conferenceMap.get(conferenceId);
      conference.completedReporters.push({
        reporterId: reporterConference.reporterId,
        iinsafId: reporterConference.iinsafId,
        status: reporterConference.status,
        acceptedAt: reporterConference.acceptedAt,
        completedAt: reporterConference.completedAt,
        proofSubmitted: reporterConference.proofSubmitted,
        proofDetails: reporterConference.proofDetails,
        reporterName: reporterConference.reporterId?.name || "N/A",
        reporterEmail: reporterConference.reporterId?.email || "N/A",
        reporterState: reporterConference.reporterId?.state || "N/A",
        reporterCity: reporterConference.reporterId?.city || "N/A",
      });
    });

    // Convert map to array
    const uniqueConferences = Array.from(conferenceMap.values());

    // Add complete details for all targeted users with work status and proofs
    const conferencesWithCompleteDetails = await Promise.all(
      uniqueConferences.map(async (conference) => {
        // First, get the original conference to understand targeting
        const FreeConference = require("../../models/pressConference/freeConference");
        const originalConference = await FreeConference.findOne({ 
          conferenceId: conference.conferenceId 
        });

        // Debug: Log original conference targeting data
        if (originalConference) {
          console.log(`Original Conference ${conference.conferenceId} targeting data:`);
          console.log(`  reporterId: ${originalConference.reporterId?.length || 0} reporters`);
          console.log(`  allStates: ${originalConference.allStates}`);
          console.log(`  adminSelectState: ${originalConference.adminSelectState?.length || 0} states`);
          console.log(`  adminSelectCities: ${originalConference.adminSelectCities?.length || 0} cities`);
          console.log(`  state: ${originalConference.state}`);
          console.log(`  city: ${originalConference.city}`);
        } else {
          console.log(`No original conference found for ${conference.conferenceId}`);
        }

        // Get ALL reporters who were targeted for this conference
        const User = require("../../models/userModel/userModel");
        let allTargetedReporters = [];

        if (originalConference) {
          console.log(`Determining targeting method for ${conference.conferenceId}:`);
          if (originalConference.reporterId && originalConference.reporterId.length > 0) {
            // Specific reporter selection
            console.log(`  Using specific reporter selection: ${originalConference.reporterId.length} reporters`);
            allTargetedReporters = await User.find({
              _id: { $in: originalConference.reporterId },
              role: "Reporter",
              verifiedReporter: true
            }).select("name email mobile iinsafId state city organization");
          } else if (originalConference.allStates === true) {
            // All states
            console.log(`  Using all states targeting`);
            allTargetedReporters = await User.find({
              role: "Reporter",
              verifiedReporter: true
            }).select("name email mobile iinsafId state city organization");
          } else if (originalConference.adminSelectState && originalConference.adminSelectState.length > 0) {
            // Admin selected states
            console.log(`  Using admin selected states: ${originalConference.adminSelectState.length} states`);
            const query = {
              role: "Reporter",
              verifiedReporter: true,
              state: { $in: originalConference.adminSelectState }
            };
            
            if (originalConference.adminSelectCities && originalConference.adminSelectCities.length > 0) {
              query.city = { $in: originalConference.adminSelectCities };
              console.log(`  Also filtering by cities: ${originalConference.adminSelectCities.length} cities`);
            }
            
            allTargetedReporters = await User.find(query).select("name email mobile iinsafId state city organization");
          } else if (originalConference.adminSelectCities && originalConference.adminSelectCities.length > 0) {
            // Admin selected cities
            console.log(`  Using admin selected cities: ${originalConference.adminSelectCities.length} cities`);
            allTargetedReporters = await User.find({
              role: "Reporter",
              verifiedReporter: true,
              city: { $in: originalConference.adminSelectCities }
            }).select("name email mobile iinsafId state city organization");
          } else {
            // Default location-based targeting
            console.log(`  Using default location-based targeting: ${originalConference.state}, ${originalConference.city}`);
            allTargetedReporters = await User.find({
              role: "Reporter",
              verifiedReporter: true,
              state: originalConference.state,
              city: originalConference.city
            }).select("name email mobile iinsafId state city organization");
          }
          
          console.log(`  Found ${allTargetedReporters.length} targeted reporters`);
        }

        // Get responses from ReporterConference for this specific conference
        const allReportersForConference = await ReporterConference.find({
          conferenceId: conference.conferenceId
        }).populate("reporterId", "name email mobile iinsafId state city organization");

        // Fallback: If targeting data seems incorrect (targeted < responded), 
        // use all reporters who actually responded as the targeted list
        if (allTargetedReporters.length < allReportersForConference.length) {
          console.log(`  WARNING: Targeted reporters (${allTargetedReporters.length}) < Responded reporters (${allReportersForConference.length})`);
          console.log(`  Using responded reporters as targeted reporters for accurate statistics`);
          
          // Get all unique reporter IDs who responded
          const respondedReporterIds = [...new Set(allReportersForConference.map(r => r.reporterId._id.toString()))];
          
          // Fetch their details
          allTargetedReporters = await User.find({
            _id: { $in: respondedReporterIds },
            role: "Reporter",
            verifiedReporter: true
          }).select("name email mobile iinsafId state city organization");
          
          console.log(`  Updated targeted reporters count: ${allTargetedReporters.length}`);
        }

        // Create a map of responses by reporter ID
        const responseMap = {};
        allReportersForConference.forEach(response => {
          responseMap[response.reporterId._id.toString()] = {
            status: response.status,
            acceptedAt: response.acceptedAt,
            rejectedAt: response.rejectedAt,
            completedAt: response.completedAt,
            rejectNote: response.rejectNote,
            proofSubmitted: response.proofSubmitted,
            proofDetails: response.proofDetails,
            updatedAt: response.updatedAt
          };
        });

        // Separate reporters by status (from responses) - only for this conference
        const completedReporters = allReportersForConference.filter(r => r.status === "completed");
        const acceptedReporters = allReportersForConference.filter(r => r.status === "accepted");
        const respondedReporters = allReportersForConference.filter(r => r.status === "pending");
        const rejectedReporters = allReportersForConference.filter(r => r.status === "rejected");

        // Find truly pending reporters (targeted but never responded)
        const respondedReporterIds = allReportersForConference.map(r => r.reporterId._id.toString());
        const trulyPendingReporters = allTargetedReporters.filter(reporter => 
          !respondedReporterIds.includes(reporter._id.toString())
        );

        // Combine all targeted reporters with their response status
        const allTargetedUsers = allTargetedReporters.map(reporter => {
          const response = responseMap[reporter._id.toString()];
          return {
            reporterId: reporter._id,
            iinsafId: reporter.iinsafId,
            reporterName: reporter.name || "N/A",
            reporterEmail: reporter.email || "N/A",
            reporterMobile: reporter.mobile || "N/A",
            reporterState: reporter.state || "N/A",
            reporterCity: reporter.city || "N/A",
            reporterOrganization: reporter.organization || "N/A",
            
            // Work Status Details
            workStatus: {
              status: response ? response.status : "pending", // pending, accepted, rejected, completed
              acceptedAt: response?.acceptedAt || null,
              rejectedAt: response?.rejectedAt || null,
              completedAt: response?.completedAt || null,
              rejectNote: response?.rejectNote || null,
              proofSubmitted: response?.proofSubmitted || false,
              lastUpdated: response?.updatedAt || null
            },
            
            // Proof Details (if submitted)
            proofDetails: response?.proofDetails ? {
              channelName: response.proofDetails.channelName,
              platform: response.proofDetails.platform,
              videoLink: response.proofDetails.videoLink,
              duration: response.proofDetails.duration,
              screenshot: response.proofDetails.screenshot,
              submittedAt: response.proofDetails.submittedAt,
              adminRejectNote: response.proofDetails.adminRejectNote,
              rejectedAt: response.proofDetails.rejectedAt,
              proofStatus: response.proofDetails.adminRejectNote ? "rejected" : "approved"
            } : null,
            
            // Additional metadata
            metadata: {
              hasConferenceInPanel: true,
              responseTime: response?.acceptedAt ? 
                Math.round((new Date(response.acceptedAt) - new Date(response.updatedAt)) / (1000 * 60 * 60 * 24)) : null, // days
              completionTime: response?.completedAt ? 
                Math.round((new Date(response.completedAt) - new Date(response.acceptedAt)) / (1000 * 60 * 60 * 24)) : null // days
            }
          };
        });

        // Add comprehensive data to conference object
        conference.allTargetedUsers = allTargetedUsers;
        conference.completedReporters = completedReporters.map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.iinsafId,
          status: reporter.status,
          acceptedAt: reporter.acceptedAt,
          completedAt: reporter.completedAt,
          proofSubmitted: reporter.proofSubmitted,
          proofDetails: reporter.proofDetails,
          reporterName: reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
        }));
        
        // Combine responded pending reporters with truly pending reporters
        const allPendingReporters = [
          ...respondedReporters.map(reporter => ({
            reporterId: reporter.reporterId,
            iinsafId: reporter.iinsafId,
            status: reporter.status,
            acceptedAt: reporter.acceptedAt,
            rejectedAt: reporter.rejectedAt,
            rejectNote: reporter.rejectNote,
            reporterName: reporter.reporterId?.name || "N/A",
            reporterEmail: reporter.reporterId?.email || "N/A",
            reporterState: reporter.reporterId?.state || "N/A",
            reporterCity: reporter.reporterId?.city || "N/A",
          })),
          ...trulyPendingReporters.map(reporter => ({
            reporterId: reporter._id,
            iinsafId: reporter.iinsafId,
            status: "pending",
            acceptedAt: null,
            rejectedAt: null,
            rejectNote: null,
            reporterName: reporter.name || "N/A",
            reporterEmail: reporter.email || "N/A",
            reporterState: reporter.state || "N/A",
            reporterCity: reporter.city || "N/A",
          }))
        ];

        conference.pendingReporters = allPendingReporters;

        conference.acceptedReporters = acceptedReporters.map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.iinsafId,
          status: reporter.status,
          acceptedAt: reporter.acceptedAt,
          proofSubmitted: reporter.proofSubmitted,
          proofDetails: reporter.proofDetails,
          reporterName: reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
        }));

        conference.rejectedReporters = rejectedReporters.map(reporter => ({
          reporterId: reporter.reporterId,
          iinsafId: reporter.iinsafId,
          status: reporter.status,
          rejectedAt: reporter.rejectedAt,
          rejectNote: reporter.rejectNote,
          reporterName: reporter.reporterId?.name || "N/A",
          reporterEmail: reporter.reporterId?.email || "N/A",
          reporterState: reporter.reporterId?.state || "N/A",
          reporterCity: reporter.reporterId?.city || "N/A",
        }));

        // Add comprehensive counts
        conference.totalReporters = allTargetedReporters.length; // Total targeted reporters
        conference.totalCompletedReporters = conference.completedReporters.length; // Use the grouped completed reporters
        conference.totalAcceptedReporters = acceptedReporters.length; // Only accepted for this conference
        conference.totalPendingReporters = allPendingReporters.length; // Includes truly pending + responded pending
        conference.totalRejectedReporters = rejectedReporters.length; // Only rejected for this conference
        conference.totalRespondedReporters = allReportersForConference.length; // Total who responded to this conference
        conference.totalNeverRespondedReporters = trulyPendingReporters.length; // Never responded to this conference
        
        // Calculate completion ratio based on total responded
        conference.completionRatio = conference.totalRespondedReporters > 0 ? 
          `${conference.totalCompletedReporters}/${conference.totalRespondedReporters}` : 
          `${conference.totalCompletedReporters}/${conference.totalReporters}`;
        
        // Calculate completion percentage based on total responded
        conference.completionPercentage = conference.totalRespondedReporters > 0 ? 
          ((conference.totalCompletedReporters / conference.totalRespondedReporters) * 100).toFixed(1) : 
          (conference.totalReporters > 0 ? ((conference.totalCompletedReporters / conference.totalReporters) * 100).toFixed(1) : 0);

        // Add proof statistics
        conference.proofStatistics = {
          totalProofsSubmitted: allReportersForConference.filter(r => r.proofSubmitted).length,
          totalProofsApproved: allReportersForConference.filter(r => r.proofSubmitted && r.proofDetails && !r.proofDetails.adminRejectNote).length,
          totalProofsRejected: allReportersForConference.filter(r => r.proofSubmitted && r.proofDetails && r.proofDetails.adminRejectNote).length,
          totalProofsPending: allReportersForConference.filter(r => r.status === "accepted" && !r.proofSubmitted).length
        };

        // Add completion metrics
        conference.completionMetrics = {
          acceptanceRate: conference.totalReporters > 0 ? ((conference.totalAcceptedReporters + conference.totalCompletedReporters) / conference.totalReporters * 100).toFixed(1) : 0,
          completionRate: conference.totalAcceptedReporters > 0 ? (conference.totalCompletedReporters / conference.totalAcceptedReporters * 100).toFixed(1) : 0,
          proofSubmissionRate: conference.totalAcceptedReporters > 0 ? (conference.proofStatistics.totalProofsSubmitted / conference.totalAcceptedReporters * 100).toFixed(1) : 0,
          averageResponseTime: allTargetedUsers.filter(u => u.workStatus.acceptedAt).reduce((sum, u) => sum + (u.metadata.responseTime || 0), 0) / acceptedReporters.length || 0,
          averageCompletionTime: allTargetedUsers.filter(u => u.workStatus.completedAt).reduce((sum, u) => sum + (u.metadata.completionTime || 0), 0) / completedReporters.length || 0
        };

        // Debug logging
        console.log(`Conference ${conference.conferenceId}:`);
        console.log(`  Total Targeted: ${conference.totalReporters}`);
        console.log(`  Total Responded: ${conference.totalRespondedReporters}`);
        console.log(`  Completed: ${conference.totalCompletedReporters}`);
        console.log(`  Accepted: ${conference.totalAcceptedReporters}`);
        console.log(`  Pending: ${conference.totalPendingReporters}`);
        console.log(`  Rejected: ${conference.totalRejectedReporters}`);
        console.log(`  Never Responded: ${conference.totalNeverRespondedReporters}`);
        console.log(`  Completion Ratio: ${conference.completionRatio}`);
        console.log(`  Completion Percentage: ${conference.completionPercentage}%`);

        return conference;
      })
    );

    console.log(`Found ${conferencesWithCompleteDetails.length} unique completed conferences`);

    return res.status(200).json({
      success: true,
      data: {
        conferences: conferencesWithCompleteDetails,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching completed conferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Get modified conferences specifically for admin tracking
const getModifiedConferences = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    console.log("Admin request for modified conferences - Search:", search);
    
    const filter = { status: "modified" };
    
    // Add search filter
    if (search) {
      filter.$or = [
        { topic: { $regex: search, $options: 'i' } },
        { conferenceId: { $regex: search, $options: 'i' } }
      ];
      console.log("Search filter applied:", filter.$or);
    }

    const conferences = await FreeConference.find(filter)
      .populate("submittedBy", "name email organization pressConferenceId")
      .populate("adminAction.modifiedBy", "name email")
      .sort({ modifiedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log("Found modified conferences:", conferences.length);

    // Add admin targeting information and reporter details
    const conferencesWithDetails = await Promise.all(
      conferences.map(async (conference) => {
        const conferenceObject = conference.toObject();

        // Add admin targeting information
        conferenceObject.adminTargeting = {
          allStates: conferenceObject.allStates,
          adminSelectState: conferenceObject.adminSelectState,
          adminSelectCities: conferenceObject.adminSelectCities,
          adminSelectPincode: conferenceObject.adminSelectPincode,
          reporterId: conferenceObject.reporterId,
          modifiedAt: conferenceObject.modifiedAt
        };

        // Add reporter details
        try {
          const ReporterConference = require("../../models/reporterConference/reporterConference");
          const User = require("../../models/userModel/userModel");

          const acceptedReporters = await ReporterConference.find({
            conferenceId: conferenceObject.conferenceId,
            status: { $in: ["accepted", "completed"] }
          }).select("reporterId iinsafId status proofSubmitted acceptedAt completedAt proofDetails.videoLink proofDetails.channelName proofDetails.platform proofDetails.duration proofDetails.screenshot proofDetails.submittedAt proofDetails.rejectedAt proofDetails.rejectReason");

          const reporterDetails = await Promise.all(
            acceptedReporters.map(async (reporter) => {
              const user = await User.findById(reporter.reporterId).select("name email state city");
              return {
                ...reporter.toObject(),
                reporterName: user ? user.name : "N/A",
                reporterEmail: user ? user.email : "N/A",
                reporterState: user ? user.state : "N/A",
                reporterCity: user ? user.city : "N/A",
              };
            })
          );

          const totalProofSubmitted = reporterDetails.filter(
            (r) => r.proofSubmitted && r.status === "completed"
          ).length;
          const totalProofPending = reporterDetails.filter(
            (r) => !r.proofSubmitted || r.status === "accepted"
          ).length;

          return {
            ...conferenceObject,
            acceptedReporters: reporterDetails,
            totalAcceptedReporters: reporterDetails.length,
            totalProofSubmitted: totalProofSubmitted,
            totalProofPending: totalProofPending,
          };
        } catch (reporterError) {
          console.error("Error fetching reporter details:", reporterError);
          return conferenceObject;
        }
      })
    );

    const totalCount = await FreeConference.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Modified conferences fetched successfully",
      data: conferencesWithDetails,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching modified conferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Admin reject conference proof
const adminRejectConferenceProof = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;
    const { adminRejectNote } = req.body;

    if (!adminRejectNote || adminRejectNote.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Admin rejection note is required",
      });
    }

    const ReporterConference = require("../../models/reporterConference/reporterConference");

    // Find the reporter conference record
    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted",
      proofSubmitted: true
    });

    if (!reporterConference) {
      return res.status(404).json({
        success: false,
        message: "Conference proof not found or not submitted",
      });
    }

    // Update the proof details with admin rejection note
    reporterConference.proofDetails.adminRejectNote = adminRejectNote.trim();
    reporterConference.proofDetails.rejectedAt = new Date();

    await reporterConference.save();

    console.log(`✅ Admin rejected conference proof for ${conferenceId} by reporter ${reporterId}`);
    console.log(`Admin rejection note: ${adminRejectNote}`);

    return res.status(200).json({
      success: true,
      message: "Conference proof rejected successfully",
      data: {
        conferenceId: reporterConference.conferenceId,
        reporterId: reporterConference.reporterId,
        adminRejectNote: reporterConference.proofDetails.adminRejectNote,
        rejectedAt: reporterConference.proofDetails.rejectedAt,
      },
    });

  } catch (error) {
    console.error("Error rejecting conference proof:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while rejecting conference proof",
    });
  }
};

// Admin approve conference proof
const adminApproveConferenceProof = async (req, res) => {
  try {
    const { conferenceId, reporterId } = req.params;

    const ReporterConference = require("../../models/reporterConference/reporterConference");

    // Find the reporter conference record
    const reporterConference = await ReporterConference.findOne({
      conferenceId: conferenceId,
      reporterId: reporterId,
      status: "accepted",
      proofSubmitted: true
    });

    if (!reporterConference) {
      return res.status(404).json({
        success: false,
        message: "Conference proof not found or not submitted",
      });
    }

    // Update status to completed and clear rejection note
    reporterConference.status = "completed";
    reporterConference.completedAt = new Date();
    reporterConference.proofDetails.adminRejectNote = "";
    reporterConference.proofDetails.rejectedAt = null;

    await reporterConference.save();

    console.log(`✅ Admin approved conference proof for ${conferenceId} by reporter ${reporterId}`);

    return res.status(200).json({
      success: true,
      message: "Conference proof approved successfully",
      data: {
        conferenceId: reporterConference.conferenceId,
        reporterId: reporterConference.reporterId,
        status: reporterConference.status,
        completedAt: reporterConference.completedAt,
      },
    });

  } catch (error) {
    console.error("Error approving conference proof:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while approving conference proof",
    });
  }
};

module.exports = {
  submitFreeConference,
  getAllFreeConferences,
  getFreeConferenceById,
  adminAction,
  getUserConferences,
  markConferenceCompleted,
  testConferenceData,
  getCompletedConferences,
  getModifiedConferences,
  adminRejectConferenceProof,
  adminApproveConferenceProof,
};
