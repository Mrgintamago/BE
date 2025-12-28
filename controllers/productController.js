const Product = require("./../models/productModel");
const catchAsync = require("./../utils/catchAsync");
const factory = require("./handlerFactory");
const AppError = require("./../utils/appError");
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");
const multer = require("multer");

const uploadFiles = upload.fields([{ name: "images", maxCount: 5 }]);
exports.uploadProductImages = (req, res, next) => {
  uploadFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError("Vượt quá số lượng file quy định.", 400),
          false
        );
      }
    } else if (err) {
      return next(new AppError("Upload thất bại.", 400), false);
    }
    if (req.body.promotion == "") req.body.promotion = req.body.price;
    next();
  });
};

exports.resizeProductImages = catchAsync(async (req, res, next) => {
  if (req.files === undefined || !req.files.images) return next();
  
  // Check if Cloudinary is configured
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloud_name || !api_key || !api_secret || 
      cloud_name === "your_cloud_name" || 
      api_key === "your_api_key" || 
      api_secret === "your_api_secret") {
    return next(
      new AppError(
        "Cloudinary chưa được cấu hình. Vui lòng cập nhật CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, và CLOUDINARY_API_SECRET trong file config.env",
        500
      )
    );
  }
  
  req.body.images = [];
  // Upload images in parallel for better performance
  try {
    const uploadPromises = req.files.images.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'products',
        quality: 'auto',
        fetch_format: 'auto',
      });
      return result.url;
    });
    
    req.body.images = await Promise.all(uploadPromises);
  } catch (error) {
    return next(
      new AppError(
        `Lỗi khi upload ảnh lên Cloudinary: ${error.message}`,
        500
      )
    );
  }
  next();
});
exports.deleteImageCloud = catchAsync(async (req, res, next) => {
  if (
    req.body.action == "Edit" &&
    (req.files === undefined || !req.files.images)
  )
    return next();
  
  // Check if Cloudinary is configured
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloud_name || !api_key || !api_secret || 
      cloud_name === "your_cloud_name" || 
      api_key === "your_api_key" || 
      api_secret === "your_api_secret") {
    // Skip deletion if Cloudinary is not configured
    console.warn("⚠️  Cloudinary not configured, skipping image deletion");
    return next();
  }
  
  let product = await Product.findById(req.params.id);

  // Delete image from cloudinary
  if (product && product.images) {
    for (const imageURL of product.images) {
      try {
        const getPublicId = imageURL.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(getPublicId);
      } catch (error) {
        console.error(`Error deleting image from Cloudinary: ${error.message}`);
        // Continue with other images even if one fails
      }
    }
  }

  next();
});
exports.aliasTopProducts = (req, res, next) => {
  req.query.limit = "5";
  req.query.sort = "-ratingsAverage,price";
  req.query.fields = "name,price,priceDiscount,ratingsAverage,title";
  next();
};
exports.getAllProducts = factory.getAll(Product);
exports.getProduct = factory.getOne(Product, { path: "reviews" });
exports.createProduct = factory.createOne(Product);
exports.updateProduct = factory.updateOne(Product);
exports.deleteProduct = factory.deleteOne(Product);

exports.getTableProduct = factory.getTable(Product);
