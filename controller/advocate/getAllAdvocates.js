const AdvocateUser = require("../../models/advocateUser/advocateUser");

// Public endpoint to get all verified advocates for homepage display
const getAllAdvocates = async (req, res) => {
  try {
    // Fetch only verified advocates with essential fields for public display
    const advocates = await AdvocateUser.find({
      isVerified: true
    })
      .select("name profileImage state city specialization experience advocateId")
      .sort({ createdAt: -1 }) // Most recent first
      .limit(50); // Limit to 50 advocates for homepage

    // If no verified advocates found, return success with empty array and message
    if (advocates.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: "No verified advocates available at the moment. Check back soon!"
      });
    }

    // Map advocates to include rating (can be enhanced later with actual rating system)
    const advocatesWithRating = advocates.map(advocate => ({
      _id: advocate._id,
      name: advocate.name,
      profileImage: advocate.profileImage || null,
      state: advocate.state,
      city: advocate.city,
      specialization: advocate.specialization,
      experience: advocate.experience,
      advocateId: advocate.advocateId,
      rating: 5, // Default rating, can be replaced with actual rating system
      location: `${advocate.city}, ${advocate.state}`
    }));

    return res.json({
      success: true,
      data: advocatesWithRating,
      count: advocatesWithRating.length,
      message: `Found ${advocatesWithRating.length} verified advocates`
    });
  } catch (err) {
    console.error("Get all advocates error:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

module.exports = getAllAdvocates;

