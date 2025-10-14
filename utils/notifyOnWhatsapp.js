const axios = require("axios");

const notifyOnWhatsapp = async (mobile, templateName, templateParams = [], mediaUrl = null) => {
  try {
    const apiKey = process.env.AISENSY_API_KEY;
    const destination = `91${mobile}`;
    const userName = "iinsaf-new"; // ✅ Your AiSensy username
    const source = "iinsaf-platform"; // ✅ Adjust to your project name

    const payload = {
      apiKey,
      campaignName: templateName,   // ✅ Use dynamic template name
      destination,
      userName,
      source,
      templateParams,               // ✅ Pass dynamic variables
      media: mediaUrl
        ? {
            url: mediaUrl,
            filename: "media"
          }
        : {},
      buttons: [],
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: {}
    };

    const response = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      payload
    );

    console.log(`✅ WhatsApp Notification sent [${templateName}] to ${mobile}`);
    return response.data;

  } catch (error) {
    console.error("❌ WhatsApp Error:", error?.response?.data || error.message);
  }
};

module.exports = notifyOnWhatsapp;
