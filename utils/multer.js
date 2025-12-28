const multer = require("multer");
const path = require("path");

// SECURITY: File upload validation
// Use memory storage for Vercel serverless functions (no persistent filesystem)
module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // SECURITY: MIME type validation
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ];
    
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error(`Định dạng file ${file.mimetype} không được hỗ trợ.`), false);
      return;
    }
    
    let ext = path.extname(file.originalname).toLowerCase();  
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi"];
    if (!allowedExts.includes(ext)) {
      cb(new Error(`Định dạng file ${ext} không được hỗ trợ. Chỉ chấp nhận: ${allowedExts.join(", ")}`), false);
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // SECURITY: Reduced to 5MB (was 10MB)
  }
});