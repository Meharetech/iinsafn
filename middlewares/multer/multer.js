const multer = require("multer");
const path = require("path");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter to allow only images/videos
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "video/mp4", "video/mpeg"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed"), false);
  }
};

// Configure multer with storage, file filter, and size limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 300, // 300MB file size limit
  }
});

module.exports = {
  // For advertiser ads: image OR video
  advertiserUpload: upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),

  // For reporter ID card: 2 images
  reporterIdCardUpload: upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "channelLogo", maxCount: 1 }
  ]),

  reporterProofUpload: upload.single("screenshot"), // field name must match frontend/postman key

  // ✅ For Raise Your Voice user: image OR video
  ryvMediaUpload: upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),

  freeAdsUpload: upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
};
