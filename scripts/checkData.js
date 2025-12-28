const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Product = require("../models/productModel");
const Brand = require("../models/brandModel");
const Category = require("../models/categoryModel");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    checkData();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function checkData() {
  try {
    console.log("\n📊 Kiểm tra dữ liệu trong database...\n");

    // Đếm Users
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: "admin" });
    console.log(`👥 Users: ${userCount} (Admin: ${adminCount})`);

    // Đếm Categories
    const categoryCount = await Category.countDocuments();
    const categories = await Category.find().select("name");
    console.log(`\n📁 Categories: ${categoryCount}`);
    categories.forEach(cat => console.log(`   - ${cat.name}`));

    // Đếm Brands
    const brandCount = await Brand.countDocuments();
    const brands = await Brand.find().select("name");
    console.log(`\n🏷️  Brands: ${brandCount}`);
    brands.forEach(b => console.log(`   - ${b.name}`));

    // Đếm Products
    const productCount = await Product.countDocuments();
    console.log(`\n📦 Products: ${productCount}`);
    
    if (productCount > 0) {
      const products = await Product.find().select("title price inventory").limit(10);
      console.log("\n   Một số sản phẩm:");
      products.forEach(p => {
        console.log(`   - ${p.title}`);
        console.log(`     Giá: ${p.price.toLocaleString("vi-VN")} VNĐ | Tồn kho: ${p.inventory}`);
      });
      if (productCount > 10) {
        console.log(`   ... và ${productCount - 10} sản phẩm khác`);
      }
    }

    console.log("\n✅ Kiểm tra hoàn tất!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi:", error.message);
    process.exit(1);
  }
}

