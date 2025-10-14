const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  registerPodcastStudio,
  getAllStudios,
  getStudioById,
  getStudiosByOwner,
  getStudioSubmissionStatus,
  updateStudioStatus
} = require("../../controller/podcast/podcastStudioController");
const podcastAuthenticate = require("../../middlewares/podcastAuth/podcastAuthenticate");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'temp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'studio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    console.log('File received:', file.originalname, 'Type:', file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Public routes (no authentication required)
router.get("/studios", getAllStudios);
router.get("/studios/:id", getStudioById);

// Protected routes (authentication required)
router.post("/studio/register", podcastAuthenticate, upload.array('images', 10), registerPodcastStudio);
router.get("/studio/my-studios", podcastAuthenticate, getStudiosByOwner);
router.get("/studio/submission-status", podcastAuthenticate, getStudioSubmissionStatus);

// Admin routes (for status updates)
router.patch("/studio/:id/status", podcastAuthenticate, updateStudioStatus);

module.exports = router;
