const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    updateAdminPassword();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function updateAdminPassword() {
  try {
    const email = process.argv[2] || "admin@hctech.com";
    const newPassword = process.argv[3] || "admin";

    // Tìm user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`\n❌ Không tìm thấy user với email: ${email}`);
      process.exit(1);
    }

    // Cập nhật password
    user.password = newPassword;
    user.passwordConfirm = newPassword;
    user.active = "active"; // Đảm bảo user được active
    await user.save({ validateBeforeSave: false });

    console.log("\n✅ Đã cập nhật password thành công!");
    console.log(`   Email: ${email}`);
    console.log(`   Password mới: ${newPassword}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.active}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi cập nhật password:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

