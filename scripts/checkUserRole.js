const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const User = require("../models/userModel");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    checkUserRole();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function checkUserRole() {
  try {
    const email = process.argv[2] || "salesstaff@tqn.com";
    
    // Find user with all fields including password
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(0);
    }
    
    console.log(`\n✅ User found:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: '${user.role}'`);
    console.log(`  Role type: ${typeof user.role}`);
    console.log(`  Role length: ${user.role?.length}`);
    console.log(`  Role charCodes:`, user.role?.split('').map(c => c.charCodeAt(0)));
    console.log(`  Active: ${user.active}`);
    console.log(`  Full user object:`, JSON.stringify(user.toObject(), null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}
