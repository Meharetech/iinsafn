const User = require("../../../models/userModel/userModel");

// Test endpoint to check and create influencers
const testInfluencers = async (req, res) => {
  try {
    console.log("🔍 Testing influencer system...");
    
    // Check existing influencers
    const totalInfluencers = await User.countDocuments({ role: "Influencer" });
    const verifiedInfluencers = await User.countDocuments({ role: "Influencer", isVerified: true });
    const unverifiedInfluencers = await User.countDocuments({ role: "Influencer", isVerified: false });
    
    console.log(`📊 Total influencers: ${totalInfluencers}`);
    console.log(`📊 Verified influencers: ${verifiedInfluencers}`);
    console.log(`📊 Unverified influencers: ${unverifiedInfluencers}`);
    
    // Get all influencers
    const allInfluencers = await User.find({ role: "Influencer" }).select("name email state city isVerified iinsafId");
    console.log("📋 All influencers:", allInfluencers);
    
    // If no influencers exist, create a test influencer
    if (totalInfluencers === 0) {
      console.log("🚀 Creating test influencer...");
      
      const testInfluencer = new User({
        name: "Test Influencer",
        email: "testinfluencer@example.com",
        mobile: "9999999999",
        role: "Influencer",
        state: "Haryana",
        city: "Hisar",
        gender: "male",
        aadharNo: "123456789012",
        pancard: "ABCDE1234F",
        bloodType: "O+",
        isVerified: true,
        iinsafId: "IINSAF9999"
      });
      
      await testInfluencer.save();
      console.log("✅ Test influencer created successfully");
      
      res.status(200).json({
        success: true,
        message: "Test influencer created successfully",
        data: {
          totalInfluencers: 1,
          verifiedInfluencers: 1,
          testInfluencer: testInfluencer
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Influencer data retrieved successfully",
        data: {
          totalInfluencers,
          verifiedInfluencers,
          unverifiedInfluencers,
          allInfluencers
        }
      });
    }
    
  } catch (error) {
    console.error("❌ Error testing influencers:", error);
    res.status(500).json({
      success: false,
      message: "Error testing influencers",
      error: error.message
    });
  }
};

module.exports = { testInfluencers };
