const News = require("./../models/newsModel");
const catchAsync = require("./../utils/catchAsync");
const factory = require("./handlerFactory");
const AppError = require("./../utils/appError");
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");
const multer = require("multer");
const logger = require("../utils/logger");

const uploadFiles = upload.fields([{ name: "images", maxCount: 10 }]);

exports.uploadNewsImages = (req, res, next) => {
  logger.log("uploadNewsImages: Content-Type =", req.headers['content-type']);
  logger.log("uploadNewsImages: req.body before multer =", req.body);
  // Lưu author đã được set từ setAuthor middleware
  const savedAuthor = req.body.author;
  
  uploadFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error("Multer error:", err);
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError("Vượt quá số lượng file quy định.", 400),
          false
        );
      }
      return next(new AppError(`Upload error: ${err.message}`, 400), false);
    } else if (err) {
      logger.error("Upload error:", err);
      return next(new AppError(`Upload thất bại: ${err.message}`, 400), false);
    }
    logger.log("uploadNewsImages: req.files after multer =", req.files);
    logger.log("uploadNewsImages: req.body after multer =", req.body);
    // Đảm bảo author không bị ghi đè bởi multer
    if (savedAuthor) {
      req.body.author = savedAuthor;
      logger.log("uploadNewsImages: Restored author =", req.body.author);
    }
    next();
  });
};

exports.resizeNewsImages = catchAsync(async (req, res, next) => {
  logger.log("resizeNewsImages: req.body =", JSON.stringify(req.body, null, 2));
  logger.log("resizeNewsImages: req.files =", req.files);
  
  // Parse existing images if provided
  let existingImages = [];
  if (req.body.images) {
    try {
      if (typeof req.body.images === 'string') {
        // Nếu là string JSON, parse nó
        if (req.body.images.startsWith('[') || req.body.images.startsWith('{')) {
          existingImages = JSON.parse(req.body.images);
        } else {
          // Nếu không phải JSON hợp lệ, coi như mảng rỗng
          existingImages = [];
        }
      } else if (Array.isArray(req.body.images)) {
        existingImages = req.body.images;
      }
    } catch (e) {
      logger.warn("Error parsing images:", e);
      existingImages = [];
    }
  }
  
  // Check if Cloudinary is configured before uploading
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  
  const isCloudinaryConfigured = cloud_name && api_key && api_secret && 
      cloud_name !== "your_cloud_name" && 
      api_key !== "your_api_key" && 
      api_secret !== "your_api_secret";
  
  // Upload new images if any and Cloudinary is configured
  if (req.files && req.files.images && isCloudinaryConfigured) {
    try {
      // Upload images in parallel for better performance
      const uploadPromises = req.files.images.map(async (file) => {
        try {
          // Upload from buffer using base64 data URI
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;
          
          const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'news',
            quality: 'auto',
            fetch_format: 'auto',
          });
          return result.secure_url;
        } catch (error) {
          logger.error("Cloudinary upload error for file:", file.originalname, error);
          return null; // Return null for failed uploads
        }
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      // Filter out null values (failed uploads)
      existingImages.push(...uploadedUrls.filter(url => url !== null));
    } catch (error) {
      logger.error("Error uploading images:", error);
      // Continue even if some images fail
    }
  } else if (req.files && req.files.images && !isCloudinaryConfigured) {
    logger.warn("⚠️  Cloudinary chưa được cấu hình, bỏ qua upload ảnh");
  }
  
  req.body.images = existingImages;
  logger.log("resizeNewsImages: final images =", existingImages);
  next();
});

exports.deleteNewsImages = catchAsync(async (req, res, next) => {
  if (
    req.body.action == "Edit" &&
    (req.files === undefined || !req.files.images)
  )
    return next();
  
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloud_name || !api_key || !api_secret || 
      cloud_name === "your_cloud_name" || 
      api_key === "your_api_key" || 
      api_secret === "your_api_secret") {
    logger.warn("⚠️  Cloudinary not configured, skipping image deletion");
    return next();
  }
  
  let news = await News.findById(req.params.id);

  if (news && news.images) {
    for (const imageURL of news.images) {
      try {
        const getPublicId = imageURL.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(getPublicId);
      } catch (error) {
        logger.error(`Error deleting image from Cloudinary: ${error.message}`);
      }
    }
  }

  next();
});

exports.setAuthor = catchAsync(async (req, res, next) => {
  logger.log("=== setAuthor middleware ===");
  logger.log("req.user =", req.user);
  logger.log("req.body.author (before) =", req.body.author);
  logger.log("req.body.authorName (before) =", req.body.authorName);
  logger.log("req.headers.authorization =", req.headers.authorization);
  logger.log("req.cookies =", req.cookies);
  
  // Nếu req.user đã được set từ protect middleware, dùng nó
  if (req.user && req.user._id) {
    req.body.author = req.user._id.toString();
    // Nếu không có tên tác giả tùy chỉnh, dùng tên user
    if (!req.body.authorName || req.body.authorName.trim() === "") {
      req.body.authorName = req.user.name;
    }
    logger.log("setAuthor: author set from req.user to", req.body.author);
    logger.log("setAuthor: authorName set to", req.body.authorName);
    logger.log("=== end setAuthor ===");
    return next();
  }
  
  // Fallback: Nếu req.user chưa được set, thử verify token lại
  const jwt = require("jsonwebtoken");
  const { promisify } = require("util");
  const User = require("./../models/userModel");
  
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  
  if (!token) {
    logger.error("setAuthor error: No token found");
    return next(new AppError("Bạn cần đăng nhập để đăng bài viết. Vui lòng đăng nhập lại.", 401));
  }
  
  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);
    
    if (!currentUser) {
      return next(new AppError("Token người dùng không còn tồn tại.", 401));
    }
    
    req.user = currentUser;
    req.body.author = currentUser._id.toString();
    // Nếu không có tên tác giả tùy chỉnh, dùng tên user
    if (!req.body.authorName || req.body.authorName.trim() === "") {
      req.body.authorName = currentUser.name;
    }
    logger.log("setAuthor: author set from token to", req.body.author);
    logger.log("setAuthor: authorName set to", req.body.authorName);
    logger.log("=== end setAuthor ===");
    next();
  } catch (error) {
    logger.error("setAuthor error: Token verification failed", error);
    return next(new AppError("Token không hợp lệ. Vui lòng đăng nhập lại.", 401));
  }
});

exports.getAllNews = factory.getAll(News);
exports.getNews = catchAsync(async (req, res, next) => {
  // Tăng lượt xem khi lấy bài viết
  const news = await News.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate("author");

  if (!news) {
    return next(new AppError("Không tìm thấy bài viết với ID này", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      data: news,
    },
  });
});
exports.createNews = factory.createOne(News);
exports.updateNews = factory.updateOne(News);
exports.deleteNews = factory.deleteOne(News);
exports.getTableNews = factory.getTable(News);

