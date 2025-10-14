const User = require("../../../../models/userModel/userModel");

const getLocationUsers = async (req, res) => {
  try {
    const { state, cities, userType } = req.query;

    console.log("🔍 Location Users API called with:", { state, cities, userType });

    // Validation
    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State is required",
      });
    }

    if (!cities) {
      return res.status(400).json({
        success: false,
        message: "Cities are required",
      });
    }

    if (!userType) {
      return res.status(400).json({
        success: false,
        message: "User type is required",
      });
    }

    // Parse cities (comma-separated string)
    const citiesArray = cities.split(',').map(city => city.trim()).filter(city => city);

    if (citiesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one city must be provided",
      });
    }

    console.log("🔍 Parsed cities:", citiesArray);

    // Build query based on userType
    let query = {
      state: state,
      city: { $in: citiesArray }
    };

    // Add role filter based on userType
    if (userType === "reporter") {
      query.role = "Reporter";
      query.verifiedReporter = true; // Only verified reporters
    } else if (userType === "influencer") {
      query.role = "Influencer";
      query.isVerified = true; // Only verified influencers
    } else if (userType === "both") {
      query.$or = [
        { role: "Reporter", verifiedReporter: true },
        { role: "Influencer", isVerified: true }
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid userType. Must be 'reporter', 'influencer', or 'both'",
      });
    }

    console.log("🔍 MongoDB query:", JSON.stringify(query, null, 2));

    // Execute query
    const users = await User.find(query).select(
      "name fullName email phone state city role verifiedReporter isVerified iinsafId createdAt"
    );

    console.log(`✅ Found ${users.length} users for location: ${state}, cities: ${citiesArray.join(', ')}, userType: ${userType}`);

    // Separate users by role for response
    const reporters = users.filter(user => user.role === "Reporter");
    const influencers = users.filter(user => user.role === "Influencer");

    // Enhanced response with user details
    const enhancedUsers = users.map(user => ({
      _id: user._id,
      name: user.name || user.fullName,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      state: user.state,
      city: user.city,
      role: user.role,
      iinsafId: user.iinsafId,
      isVerified: user.role === "Reporter" ? user.verifiedReporter : user.isVerified,
      createdAt: user.createdAt
    }));

    res.status(200).json({
      success: true,
      message: `Users found for ${state} - ${citiesArray.join(', ')}`,
      data: {
        users: enhancedUsers,
        totalCount: users.length,
        reportersCount: reporters.length,
        influencersCount: influencers.length,
        location: {
          state: state,
          cities: citiesArray
        },
        userType: userType
      }
    });

  } catch (error) {
    console.error("Error fetching location users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching location users",
      error: error.message
    });
  }
};

module.exports = getLocationUsers;
