const Users = require('../../../../models/userModel/userModel')

const getAllReporter = async(req,res) =>{

    try {
    const { userType } = req.query;
    
    // Determine the role and verification field based on userType parameter
    let role = 'Reporter'; // default
    let verificationField = {};
    
    if (userType === 'influencer') {
      role = 'Influencer';
      verificationField = { isVerified: true }; // Influencers use isVerified
    } else {
      verificationField = { verifiedReporter: true }; // Reporters use verifiedReporter
    }
    
    console.log(`🔍 Fetching ${role}s with verification:`, verificationField);
    
    // Find users where role matches the requested type and they are verified
    const users = await Users.find({ 
      role: role,
      ...verificationField
    }).select("name email mobile iinsafId state city role");

    console.log(`📊 Found ${users.length} verified ${role.toLowerCase()}s`);
    
    // Send the data to the frontend
    res.status(200).json({ success: true, reporters: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }

}



module.exports = getAllReporter