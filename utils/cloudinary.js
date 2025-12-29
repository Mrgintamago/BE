const cloudinary = require("cloudinary").v2;
const logger = require("./logger");

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

// Check if credentials are valid (not empty and not placeholder values)
const isValid = cloud_name && 
                api_key && 
                api_secret && 
                cloud_name !== "your_cloud_name" && 
                cloud_name.trim() !== "" &&
                api_key !== "your_api_key" && 
                api_key.trim() !== "" &&
                api_secret !== "your_api_secret" && 
                api_secret.trim() !== "";

if (isValid) {
  try {
    cloudinary.config({
      cloud_name: cloud_name.trim(),
      api_key: api_key.trim(),
      api_secret: api_secret.trim(),
    });
    logger.log("✅ Cloudinary configured successfully");
  } catch (error) {
    logger.error("❌ Error configuring Cloudinary:", error.message);
  }
} else {
  // Only show warning if credentials are actually missing
  if (!cloud_name || cloud_name === "your_cloud_name" || cloud_name.trim() === "") {
    logger.warn("⚠️  CLOUDINARY_CLOUD_NAME is missing or not configured!");
  }
  if (!api_key || api_key === "your_api_key" || api_key.trim() === "") {
    logger.warn("⚠️  CLOUDINARY_API_KEY is missing or not configured!");
  }
  if (!api_secret || api_secret === "your_api_secret" || api_secret.trim() === "") {
    logger.warn("⚠️  CLOUDINARY_API_SECRET is missing or not configured!");
  }
  if (!cloud_name || !api_key || !api_secret || 
      cloud_name === "your_cloud_name" || 
      api_key === "your_api_key" || 
      api_secret === "your_api_secret") {
    logger.warn("   Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in config.env");
    logger.warn("   Get your credentials from: https://cloudinary.com/console");
  }
}

module.exports = cloudinary;