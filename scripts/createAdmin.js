const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const User = require("../models/userModel");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

if (!DB) {
  console.error("Thiếu biến môi trường MONGODB_URI trong config.env");
  process.exit(1);
}

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    createAdminUser();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function createAdminUser() {
  try {
    // Lấy thông tin từ command line arguments hoặc sử dụng giá trị mặc định
    const email = process.argv[2] || "admin@example.com";
    const password = process.argv[3] || "admin123456";
    const name = process.argv[4] || "Admin User";

    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log(`\n⚠️  Email ${email} đã tồn tại và đã là admin!`);
        process.exit(0);
      } else {
        // Cập nhật role thành admin
        existingUser.role = "admin";
        existingUser.active = "active";
        existingUser.password = password;
        existingUser.passwordConfirm = password;
        await existingUser.save();
        console.log(`\n✅ Đã cập nhật user ${email} thành admin!`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        process.exit(0);
      }
    }

    // Tạo admin user mới
    const adminUser = await User.create({
      name,
      email,
      password,
      passwordConfirm: password,
      role: "admin",
      active: "active",
    });

    console.log("\n✅ Đã tạo admin user thành công!");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Name: ${name}`);
    console.log(`\n💡 Bạn có thể đăng nhập với thông tin trên tại trang admin.`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi tạo admin user:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

