const ryvUsers = require("../../models/userModel/RaiseYourVoiceModel/raiseYourVoiceUsers");

const userProfile = async(req,res)=>{

    try{
        const userId = req.userId;

        const user = await ryvUsers.findById(userId);
        
        if(!user)
        {
            return res.status(404).json({success: false, message: "user not found"});
        }

        res.status(200).json({
                success: true,
                message: "user profile fetched successfully",
                data: user,
            })
    }
    catch(error){
        console.error("Error while fetching user profile",error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching profile"
        })
    }
}



module.exports = userProfile;