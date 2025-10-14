const axios = require("axios");

const sendWhatsappOtp = async (mobile, otp, userName) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;

    // Clean and validate userName
    let cleanUserName = userName ? userName.trim() : "User";
    if (!cleanUserName || cleanUserName.length === 0 || cleanUserName.trim().length === 0) {
      console.warn("Invalid userName format, using fallback:", userName);
      cleanUserName = "User";
    }

    const response = await axios.post("https://backend.aisensy.com/campaign/t1/api/v2", {
      apiKey,
      campaignName: "copy_otp",
      destination: `91${mobile}`,
      userName: cleanUserName,
      templateParams: [`${otp}`],
      paramsFallbackValue: { FirstName: cleanUserName },
      buttons: [
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: `${otp}`,
            },
          ],
        },
      ],
    });

    return response.data;
  } catch (error) {
    console.error("Error sending WhatsApp OTP:", error?.response?.data || error.message);
    throw new Error("Failed to send WhatsApp OTP");
  }
};

module.exports = sendWhatsappOtp;
