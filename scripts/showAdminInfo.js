const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(async () => {
    console.log("DB connection successful!\n");
    
    console.log("=".repeat(70));
    console.log("📊 THÔNG TIN ADMIN USERS");
    console.log("=".repeat(70));
    
    // Lấy tất cả users
    const allUsers = await User.find().select("-password -passwordConfirm");
    const adminUsers = await User.find({ role: "admin" }).select("-password -passwordConfirm");
    const regularUsers = await User.find({ role: "user" }).select("-password -passwordConfirm");
    const employeeUsers = await User.find({ role: "employee" }).select("-password -passwordConfirm");
    
    console.log("\n📍 Database:", mongoose.connection.db.databaseName);
    console.log("📍 Collection: users\n");
    
    console.log("👥 Tổng số users:", allUsers.length);
    console.log("   - Admin:", adminUsers.length);
    console.log("   - Employee:", employeeUsers.length);
    console.log("   - User:", regularUsers.length);
    
    if (adminUsers.length > 0) {
      console.log("\n✅ ADMIN USERS:");
      adminUsers.forEach((admin, index) => {
        console.log(`\n   ${index + 1}. ${admin.name}`);
        console.log(`      Email: ${admin.email}`);
        console.log(`      Role: ${admin.role}`);
        console.log(`      Active: ${admin.active}`);
        console.log(`      ID: ${admin._id}`);
        console.log(`      Created: ${admin.createdAt}`);
      });
    } else {
      console.log("\n⚠️  Không có admin user nào!");
      console.log("   Chạy: node scripts/createAdmin.js admin@hctech.com admin \"Admin\"");
    }
    
    console.log("\n" + "=".repeat(70));
    console.log("💡 GIẢI THÍCH:");
    console.log("=".repeat(70));
    console.log("\n1. Database 'admin' trong MongoDB:");
    console.log("   - Là database HỆ THỐNG của MongoDB");
    console.log("   - Dùng để quản lý authentication của MongoDB server");
    console.log("   - KHÔNG phải để lưu admin users của ứng dụng");
    console.log("\n2. Admin users của ứng dụng:");
    console.log(`   - Được lưu trong database: ${mongoose.connection.db.databaseName}`);
    console.log("   - Collection: users");
    console.log("   - Field: role = 'admin'");
    console.log("\n3. Để xem admin users trong MongoDB Compass:");
    console.log(`   - Kết nối: mongodb://127.0.0.1:27017/${mongoose.connection.db.databaseName}`);
    console.log("   - Chọn collection: users");
    console.log("   - Filter: { role: 'admin' }");
    console.log("\n" + "=".repeat(70) + "\n");
    
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Lỗi:", err.message);
    process.exit(1);
  });

