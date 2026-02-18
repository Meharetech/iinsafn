const User = require("../../../../models/userModel/userModel");
const freeAdModel = require("../../../../models/adminModels/freeAds/freeAdsSchema");
const FreeAdProof = require("../../../../models/adminModels/freeAds/freeAdProofSchema");
const Advertisement = require("../../../../models/advertismentPost/advertisementPost");
const ReporterAdProof = require("../../../../models/reporterAdProof/reporterAdProof");
const Wallet = require("../../../../models/Wallet/walletSchema");

/**
 * Get all verified Reporters and Influencers with their ad statistics
 */
const getUserAdsTracking = async (req, res) => {
    try {
        const { userType, search } = req.query;

        // Build query for verified users
        let query = {
            $or: [
                { role: "Reporter", verifiedReporter: true },
                { role: "Influencer", isVerified: true }
            ]
        };

        // Filter by user type if specified
        if (userType === "reporter") {
            query = { role: "Reporter", verifiedReporter: true };
        } else if (userType === "influencer") {
            query = { role: "Influencer", isVerified: true };
        }

        // Search by name or iinsafId
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            query.$and = [
                query.$or ? { $or: query.$or } : {},
                {
                    $or: [
                        { name: searchRegex },
                        { iinsafId: searchRegex },
                        { email: searchRegex }
                    ]
                }
            ];
            delete query.$or;
        }

        // Get all verified users
        const users = await User.find(query)
            .select("name email mobile iinsafId role state city organization createdAt")
            .lean();

        // For each user, calculate their ad statistics
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                // Find all FREE ads where this user is in acceptedReporters
                const freeAds = await freeAdModel.find({
                    "acceptedReporters.reporterId": user._id
                }).lean();

                // Find all PAID ads where this user is in acceptRejectReporterList
                const paidAds = await Advertisement.find({
                    "acceptRejectReporterList.reporterId": user._id
                }).lean();

                // Get wallet balance
                const wallet = await Wallet.findOne({ userId: user._id }).lean();
                const walletBalance = wallet ? wallet.balance : 0;

                // Calculate statistics from FREE ads
                let accepted = 0;
                let submitted = 0;
                let completed = 0;
                let rejected = 0;
                let totalEarnings = 0;

                freeAds.forEach(ad => {
                    const userEntry = ad.acceptedReporters.find(
                        r => r.reporterId.toString() === user._id.toString()
                    );

                    if (userEntry) {
                        if (userEntry.postStatus === "accepted") accepted++;
                        else if (userEntry.postStatus === "submitted") submitted++;
                        else if (userEntry.postStatus === "completed") {
                            completed++;
                            // Add payment for completed ads
                            totalEarnings += ad.finalReporterPrice || 0;
                        }

                        // Check if there's a rejection note (means it was rejected at some point)
                        if (userEntry.adminRejectNote) rejected++;
                    }
                });

                // Calculate statistics from PAID ads
                paidAds.forEach(ad => {
                    const userEntry = ad.acceptRejectReporterList.find(
                        r => r.reporterId.toString() === user._id.toString()
                    );

                    if (userEntry) {
                        if (userEntry.accepted && !userEntry.adProof) {
                            accepted++;
                        } else if (userEntry.adProof && !userEntry.adApproved) {
                            submitted++;
                        } else if (userEntry.adApproved) {
                            completed++;
                            totalEarnings += ad.finalReporterPrice || 0;
                        }

                        if (userEntry.rejected || userEntry.adminRejectNote) {
                            rejected++;
                        }
                    }
                });

                // Also check FreeAdProof for rejected proofs
                const rejectedProofs = await FreeAdProof.countDocuments({
                    reporterId: user._id,
                    status: "rejected"
                });

                return {
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    iinsafId: user.iinsafId,
                    role: user.role,
                    state: user.state,
                    city: user.city,
                    organization: user.organization,
                    joinedAt: user.createdAt,
                    stats: {
                        totalAds: freeAds.length + paidAds.length,
                        accepted,
                        submitted,
                        completed,
                        rejected: rejected + rejectedProofs,
                        totalEarnings: totalEarnings,
                        walletBalance: walletBalance
                    }
                };
            })
        );
        // Sort by total ads (most active users first)
        usersWithStats.sort((a, b) => b.stats.totalAds - a.stats.totalAds);

        res.status(200).json({
            success: true,
            message: "User ads tracking fetched successfully",
            count: usersWithStats.length,
            data: usersWithStats
        });
    } catch (error) {
        console.error("Error in getUserAdsTracking:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching user ads tracking",
            error: error.message
        });
    }
};

/**
 * Get detailed ad history for a specific user
 */
const getUserAdDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user exists
        const user = await User.findById(userId)
            .select("name email mobile iinsafId role state city organization")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get wallet balance
        const wallet = await Wallet.findOne({ userId: userId }).lean();
        const walletBalance = wallet ? wallet.balance : 0;

        // Find all FREE ads where this user is in acceptedReporters
        const freeAds = await freeAdModel.find({
            "acceptedReporters.reporterId": userId
        })
            .select("description adType mediaType imageUrl videoUrl status createdAt acceptedReporters finalReporterPrice requiredReportersCount adState adCity targetAudience")
            .lean();

        // Find all PAID ads where this user is in acceptRejectReporterList
        const paidAds = await Advertisement.find({
            "acceptRejectReporterList.reporterId": userId
        })
            .select("mediaDescription adType mediaType media imageUrl videoUrl status createdAt acceptRejectReporterList finalReporterPrice requiredReporter pfState pfCities targetAudience platforms startDate endDate")
            .lean();

        // Get all proofs submitted by this user (for free ads)
        const userProofs = await FreeAdProof.find({
            reporterId: userId
        })
            .populate("adId", "description adType")
            .lean();

        // Get all proofs submitted by this user (for paid ads)
        const paidProofsDocs = await ReporterAdProof.find({
            "proofs.reporterId": userId
        }).lean();

        // Format FREE ad details
        let totalEarnings = 0;
        const freeAdDetails = freeAds.map(ad => {
            const userEntry = ad.acceptedReporters.find(
                r => r.reporterId.toString() === userId.toString()
            );

            // Find matching proof
            const proof = userProofs.find(
                p => p.adId && p.adId._id.toString() === ad._id.toString()
            );

            // Calculate earnings for completed ads
            if (userEntry?.postStatus === "completed") {
                totalEarnings += ad.finalReporterPrice || 0;
            }

            return {
                adId: ad._id,
                description: ad.description,
                adType: ad.adType,
                mediaType: ad.mediaType,
                imageUrl: ad.imageUrl,
                videoUrl: ad.videoUrl,
                adStatus: ad.status,
                createdAt: ad.createdAt,
                payment: ad.finalReporterPrice || 0,
                requiredReporters: ad.requiredReportersCount,
                targetLocation: {
                    state: ad.adState,
                    city: ad.adCity
                },
                targetAudience: ad.targetAudience,
                userStatus: userEntry?.postStatus || "unknown",
                acceptedAt: userEntry?.acceptedAt,
                submittedAt: userEntry?.submittedAt,
                completedAt: userEntry?.completedAt,
                rejectedAt: userEntry?.rejectedAt,
                rejectNote: userEntry?.adminRejectNote,
                isPaid: false, // Mark as free ad
                proof: proof ? {
                    screenshot: proof.screenshot,
                    channelName: proof.channelName,
                    videoLink: proof.videoLink,
                    platform: proof.platform,
                    duration: proof.duration,
                    status: proof.status,
                    submittedAt: proof.submittedAt
                } : null
            };
        });

        // Format PAID ad details
        const paidAdDetails = paidAds.map(ad => {
            const userEntry = ad.acceptRejectReporterList.find(
                r => r.reporterId.toString() === userId.toString()
            );

            // Find matching proof from paid proofs
            let paidProof = null;
            const proofDoc = paidProofsDocs.find(p => p.adId.toString() === ad._id.toString());
            if (proofDoc) {
                paidProof = proofDoc.proofs.find(p => p.reporterId.toString() === userId.toString());
            }

            // Calculate earnings for completed ads
            if (userEntry?.postStatus === "completed" || (userEntry?.adApproved && userEntry?.adProof)) {
                totalEarnings += ad.finalReporterPrice || 0;
            }

            // Determine user status based on paid ad fields
            let userStatus = userEntry?.postStatus || "unknown";
            if (userStatus === "unknown" && userEntry) {
                if (userEntry.adApproved) {
                    userStatus = "completed";
                } else if (userEntry.adProof) {
                    userStatus = "submitted";
                } else if (userEntry.accepted) {
                    userStatus = "accepted";
                } else if (userEntry.rejected) {
                    userStatus = "rejected";
                }
            }

            return {
                adId: ad._id,
                description: ad.mediaDescription,
                adType: ad.adType,
                mediaType: ad.mediaType,
                // Robust media mapping
                imageUrl: ad.imageUrl || ad.media || (ad.mediaType === "image" || ad.mediaType === "Banner" ? ad.media : null),
                videoUrl: ad.videoUrl || ad.media || (ad.mediaType === "video" ? ad.media : null),
                adStatus: ad.status,
                createdAt: ad.createdAt,
                startDate: ad.startDate,
                endDate: ad.endDate,
                payment: ad.finalReporterPrice || 0,
                requiredReporters: ad.requiredReporter,
                targetLocation: {
                    state: ad.pfState,
                    city: ad.pfCities ? (Array.isArray(ad.pfCities) ? ad.pfCities.join(", ") : ad.pfCities) : ""
                },
                targetAudience: ad.targetAudience,
                platforms: ad.platforms,
                userStatus: userStatus,
                acceptedAt: userEntry?.acceptedAt,
                submittedAt: userEntry?.submittedAt || paidProof?.submittedAt,
                rejectedAt: userEntry?.rejectedAt || paidProof?.initialProofRejectedAt,
                rejectNote: userEntry?.rejectNote || paidProof?.initialProofRejectNote,
                isPaid: true, // Mark as paid ad
                proof: paidProof ? {
                    screenshot: paidProof.screenshot,
                    completedTaskScreenshot: paidProof.completedTaskScreenshot,
                    channelName: paidProof.channelName,
                    platform: paidProof.platform,
                    duration: paidProof.duration,
                    videoLink: paidProof.videoLink,
                    iinsafId: paidProof.iinsafId || userEntry?.iinsafId,
                    status: paidProof.status || (userEntry?.adApproved ? "approved" : "submitted"),
                    submittedAt: paidProof.submittedAt
                } : (userEntry?.iinsafId ? { iinsafId: userEntry.iinsafId } : null)
            };
        });

        // Combine both free and paid ads
        const adDetails = [...freeAdDetails, ...paidAdDetails];

        // Sort by most recent first
        adDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            success: true,
            message: "User ad details fetched successfully",
            user,
            totalAds: adDetails.length,
            totalEarnings,
            walletBalance,
            data: adDetails
        });
    } catch (error) {
        console.error("Error in getUserAdDetails:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching user ad details",
            error: error.message
        });
    }
};

module.exports = {
    getUserAdsTracking,
    getUserAdDetails
};
