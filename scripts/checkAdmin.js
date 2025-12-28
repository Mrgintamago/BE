const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    checkAdminUsers();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function checkAdminUsers() {
  try {
    const adminUsers = await User.find({ role: "admin" }).select(
      "+password -passwordConfirm"
    );
    
    if (adminUsers.length === 0) {
      console.log("\n❌ Không tìm thấy admin user nào trong database!");
      console.log("\n💡 Bạn cần tạo admin user. Có thể:");
      console.log("   1. Tạo user mới qua API signup và sau đó cập nhật role thành 'admin'");
      console.log("   2. Sử dụng script createAdmin.js để tạo admin user");
    } else {
      console.log(`\n✅ Tìm thấy ${adminUsers.length} admin user(s):\n`);
      adminUsers.forEach((user, index) => {
        console.log(`Admin ${index + 1}:`);
        console.log(`  - Email: ${user.email}`);
        console.log(`  - Name: ${user.name}`);
        console.log(`  - Active: ${user.active}`);
        console.log(`  - Created: ${user.createdAt}`);
        console.log(`  - Password: (đã được hash, không thể hiển thị)`);
        console.log("");
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error checking admin users:", error);
    process.exit(1);
  }
}

