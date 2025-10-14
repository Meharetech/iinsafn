const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (localPath, folderName) => {
  try {
    if (!localPath) return null;

    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "auto",
      folder: folderName || "misc", // default fallback folder
    });

    fs.unlinkSync(localPath); // remove file from server
    console.log("File uploaded successfully:", result.url);
    return result;
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    fs.unlinkSync(localPath);
    return null;
  }
};



module.exports =  uploadToCloudinary ;
