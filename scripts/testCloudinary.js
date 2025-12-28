const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: "./config.env" });

console.log("Testing Cloudinary configuration...\n");

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

console.log("Environment variables:");
console.log(`  CLOUDINARY_CLOUD_NAME: ${cloud_name ? `"${cloud_name}"` : "undefined"}`);
console.log(`  CLOUDINARY_API_KEY: ${api_key ? `"${api_key}"` : "undefined"}`);
console.log(`  CLOUDINARY_API_SECRET: ${api_secret ? `"${api_secret.substring(0, 10)}..."` : "undefined"}`);

console.log("\nValidation:");
console.log(`  cloud_name exists: ${!!cloud_name}`);
console.log(`  cloud_name is not placeholder: ${cloud_name !== "your_cloud_name"}`);
console.log(`  api_key exists: ${!!api_key}`);
console.log(`  api_key is not placeholder: ${api_key !== "your_api_key"}`);
console.log(`  api_secret exists: ${!!api_secret}`);
console.log(`  api_secret is not placeholder: ${api_secret !== "your_api_secret"}`);

const isValid = cloud_name && 
                api_key && 
                api_secret && 
                cloud_name !== "your_cloud_name" && 
                cloud_name.trim() !== "" &&
                api_key !== "your_api_key" && 
                api_key.trim() !== "" &&
                api_secret !== "your_api_secret" && 
                api_secret.trim() !== "";

console.log(`\n✅ Configuration valid: ${isValid ? "YES" : "NO"}`);

if (isValid) {
  console.log("\n✅ Cloudinary credentials are properly configured!");
} else {
  console.log("\n❌ Cloudinary credentials are missing or invalid!");
  console.log("   Please check your config.env file.");
}

