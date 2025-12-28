const mongoose = require("mongoose");
const Brand = require("../models/brandModel");
require("dotenv").config({ path: "./config.env" });

// Fix Mongoose deprecation warning
mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    updateBrands();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function updateBrands() {
  try {
    console.log("\n🔄 Bắt đầu cập nhật brands...\n");

    // Danh sách brands cũ cần xóa (nếu muốn)
    const oldBrands = [
      "Good Smile Company",
      "Bandai",
      "Kotobukiya",
      "FREEing",
      "Max Factory",
      "Alter",
      "Aniplex",
      "MegaHouse",
    ];

    // Danh sách brands mới
    const newBrands = [
      "TFTOYS",
      "Mon Studio",
      "Recast",
      "KD Studio",
      "Recast White Hole",
      "TF Toys Recast White Hole",
      "Recast TH",
      "Recast Queen Studio",
    ];

    // Tạo brands mới
    console.log("📝 Đang tạo brands mới...");
    for (const brandName of newBrands) {
      let brand = await Brand.findOne({ name: brandName });
      if (!brand) {
        brand = await Brand.create({ name: brandName });
        console.log(`   ✅ Đã tạo brand: ${brand.name}`);
      } else {
        console.log(`   ℹ️  Brand đã tồn tại: ${brand.name}`);
      }
    }

    // Cập nhật products đang sử dụng brands cũ sang brands mới
    console.log("\n🔄 Đang cập nhật products sang brands mới...");
    const Product = require("../models/productModel");
    
    // Lấy brand mặc định (brand đầu tiên trong danh sách mới)
    const defaultBrand = await Brand.findOne({ name: newBrands[0] });
    if (!defaultBrand) {
      console.error("❌ Không tìm thấy brand mặc định!");
      process.exit(1);
    }

    for (const oldBrandName of oldBrands) {
      const oldBrand = await Brand.findOne({ name: oldBrandName });
      if (oldBrand) {
        // Đếm products đang sử dụng brand này
        const productsUsingBrand = await Product.countDocuments({
          brand: oldBrand._id,
        });
        
        if (productsUsingBrand > 0) {
          // Cập nhật tất cả products sang brand mặc định
          await Product.updateMany(
            { brand: oldBrand._id },
            { brand: defaultBrand._id }
          );
          console.log(
            `   ✅ Đã cập nhật ${productsUsingBrand} products từ "${oldBrandName}" sang "${defaultBrand.name}"`
          );
        }
      }
    }

    // Xóa brands cũ
    console.log("\n🗑️  Đang xóa brands cũ...");
    for (const oldBrandName of oldBrands) {
      const oldBrand = await Brand.findOne({ name: oldBrandName });
      if (oldBrand) {
        await Brand.findByIdAndDelete(oldBrand._id);
        console.log(`   ✅ Đã xóa brand: ${oldBrandName}`);
      }
    }

    console.log("\n✅ Cập nhật brands hoàn tất!\n");
    console.log("📋 Danh sách brands hiện tại:");
    const allBrands = await Brand.find().sort({ name: 1 });
    allBrands.forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi cập nhật brands:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

