/**
 * Middleware to handle multer file upload errors
 */
const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    
    // Handle file size limit exceeded error
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File size limit exceeded. Maximum allowed size is 300MB.'
      });
    }
    
    // Handle file type error
    if (err.message === 'Only images and videos are allowed') {
      return res.status(415).json({
        success: false,
        message: 'Only images (JPEG, PNG) and videos (MP4, MPEG) are allowed.'
      });
    }
    
    // Handle other multer errors
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  
  next();
};

module.exports = multerErrorHandler;
