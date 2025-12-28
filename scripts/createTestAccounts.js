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
    createTestAccounts();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function createTestAccounts() {
  try {
    const testAccounts = [
      {
        name: "Super Admin",
        email: "superadmin@test.com",
        password: "superadmin123",
        role: "super_admin",
      },
      {
        name: "Admin",
        email: "admin@test.com",
        password: "admin123",
        role: "admin",
      },
      {
        name: "Manager",
        email: "manager@test.com",
        password: "manager123",
        role: "manager",
      },
      {
        name: "Sales Staff",
        email: "salesstaff@test.com",
        password: "sales123",
        role: "sales_staff",
      },
    ];

    console.log("\n🔧 Đang tạo các tài khoản test...\n");

    for (const account of testAccounts) {
      try {
        // Kiểm tra xem email đã tồn tại chưa
        const existingUser = await User.findOne({ email: account.email });
        
        if (existingUser) {
          // Cập nhật role và password nếu user đã tồn tại
          existingUser.role = account.role;
          existingUser.active = "active";
          existingUser.password = account.password;
          existingUser.passwordConfirm = account.password;
          existingUser.name = account.name;
          await existingUser.save();
          console.log(`✅ Đã cập nhật tài khoản: ${account.name}`);
          console.log(`   Email: ${account.email}`);
          console.log(`   Password: ${account.password}`);
          console.log(`   Role: ${account.role}\n`);
        } else {
          // Tạo user mới
          const user = await User.create({
            name: account.name,
            email: account.email,
            password: account.password,
            passwordConfirm: account.password,
            role: account.role,
            active: "active",
          });
          console.log(`✅ Đã tạo tài khoản: ${account.name}`);
          console.log(`   Email: ${account.email}`);
          console.log(`   Password: ${account.password}`);
          console.log(`   Role: ${account.role}\n`);
        }
      } catch (error) {
        console.error(`❌ Lỗi khi tạo/cập nhật tài khoản ${account.name}:`, error.message);
      }
    }

    console.log("\n📋 TÓM TẮT CÁC TÀI KHOẢN TEST:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1. SUPER ADMIN (Cấu hình & phân quyền)");
    console.log("   Email: superadmin@test.com");
    console.log("   Password: superadmin123");
    console.log("   Quyền: Full access - Quản lý tất cả, bao gồm phân quyền\n");
    
    console.log("2. ADMIN (Vận hành shop)");
    console.log("   Email: admin@test.com");
    console.log("   Password: admin123");
    console.log("   Quyền: Quản lý sản phẩm, đơn hàng, nhập kho, reviews, news\n");
    
    console.log("3. MANAGER (Báo cáo & duyệt)");
    console.log("   Email: manager@test.com");
    console.log("   Password: manager123");
    console.log("   Quyền: Xem báo cáo, duyệt đơn hàng, duyệt đăng ký đối tác\n");
    
    console.log("4. SALES STAFF (Xử lý đơn & khách)");
    console.log("   Email: salesstaff@test.com");
    console.log("   Password: sales123");
    console.log("   Quyền: Xử lý đơn hàng, xem thông tin khách hàng\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Bạn có thể đăng nhập với các tài khoản trên tại trang admin.");
    console.log("   URL: http://localhost:3000/login (hoặc URL server của bạn)\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi tạo test accounts:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

