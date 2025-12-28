const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Product = require("../models/productModel");
const Brand = require("../models/brandModel");
const Category = require("../models/categoryModel");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

// Fix Mongoose deprecation warning
mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB connection successful!");
    seedData();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function seedData() {
  try {
    console.log("\n🌱 Bắt đầu seed data...\n");

    // 1. Tìm hoặc tạo admin user
    let adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      console.log("⚠️  Không tìm thấy admin user. Vui lòng tạo admin user trước!");
      console.log("   Chạy: node scripts/createAdmin.js admin@hctech.com admin \"Admin\"");
      process.exit(1);
    }
    console.log("✅ Tìm thấy admin user:", adminUser.email);

    // 2. Tạo Categories
    console.log("\n📁 Đang tạo Categories...");
    const categories = [
      { name: "Scale Figure" },
      { name: "Nendoroid" },
      { name: "Figma" },
      { name: "Pop Up Parade" },
      { name: "Prize Figure" },
      { name: "Phụ kiện" },
    ];

    const createdCategories = {};
    for (const catData of categories) {
      let category = await Category.findOne({ name: catData.name });
      if (!category) {
        category = await Category.create(catData);
        console.log(`   ✅ Đã tạo category: ${category.name}`);
      } else {
        console.log(`   ℹ️  Category đã tồn tại: ${category.name}`);
      }
      createdCategories[catData.name] = category._id;
    }

    // 3. Tạo Brands
    console.log("\n🏷️  Đang tạo Brands...");
    const brands = [
      { name: "TFTOYS" },
      { name: "Mon Studio" },
      { name: "Recast" },
      { name: "KD Studio" },
      { name: "Recast White Hole" },
      { name: "TF Toys Recast White Hole" },
      { name: "Recast TH" },
      { name: "Recast Queen Studio" },
    ];

    const createdBrands = {};
    for (const brandData of brands) {
      let brand = await Brand.findOne({ name: brandData.name });
      if (!brand) {
        brand = await Brand.create(brandData);
        console.log(`   ✅ Đã tạo brand: ${brand.name}`);
      } else {
        console.log(`   ℹ️  Brand đã tồn tại: ${brand.name}`);
      }
      createdBrands[brandData.name] = brand._id;
    }

    // 4. Tạo Products
    console.log("\n📦 Đang tạo Products...");
    const products = [
      {
        title: "Monkey D. Luffy - One Piece Scale Figure 1/7",
        price: 3500000,
        promotion: 3200000,
        description: "Figure Luffy chính hãng với chi tiết tuyệt đẹp",
        category: createdCategories["Scale Figure"],
        brand: createdBrands["TFTOYS"],
        inventory: 30,
        scale: "1/7",
        series: "One Piece",
        manufacturer: "TFTOYS",
        material: "PVC, ABS",
        height: 25,
        releaseDate: "2024-03",
        character: "Monkey D. Luffy",
        type: "Scale Figure",
        color: "Đỏ",
        weight: 0.8,
        images: [],
      },
      {
        title: "Roronoa Zoro - One Piece Nendoroid",
        price: 1200000,
        promotion: 1100000,
        description: "Nendoroid Zoro với nhiều phụ kiện và biểu cảm thay đổi được",
        category: createdCategories["Nendoroid"],
        brand: createdBrands["Mon Studio"],
        inventory: 50,
        scale: "Nendoroid",
        series: "One Piece",
        manufacturer: "Mon Studio",
        material: "PVC, ABS",
        height: 10,
        releaseDate: "2024-01",
        character: "Roronoa Zoro",
        type: "Nendoroid",
        color: "Xanh lá",
        weight: 0.2,
        images: [],
      },
      {
        title: "Naruto Uzumaki - Naruto Shippuden Scale Figure 1/8",
        price: 2800000,
        promotion: 2600000,
        description: "Figure Naruto trong trạng thái Sage Mode với base đặc biệt",
        category: createdCategories["Scale Figure"],
        brand: createdBrands["Recast"],
        inventory: 25,
        scale: "1/8",
        series: "Naruto Shippuden",
        manufacturer: "Recast",
        material: "PVC",
        height: 22,
        releaseDate: "2024-02",
        character: "Naruto Uzumaki",
        type: "Scale Figure",
        color: "Cam",
        weight: 0.6,
        images: [],
      },
      {
        title: "Rem - Re:Zero Pop Up Parade",
        price: 800000,
        promotion: 750000,
        description: "Pop Up Parade Rem với giá cả phải chăng và chất lượng tốt",
        category: createdCategories["Pop Up Parade"],
        brand: createdBrands["KD Studio"],
        inventory: 100,
        scale: "Pop Up Parade",
        series: "Re:Zero",
        manufacturer: "KD Studio",
        material: "PVC",
        height: 17,
        releaseDate: "2024-04",
        character: "Rem",
        type: "Pop Up Parade",
        color: "Xanh dương",
        weight: 0.3,
        images: [],
      },
      {
        title: "Goku Super Saiyan Blue - Dragon Ball Z Figma",
        price: 1500000,
        promotion: 1400000,
        description: "Figma Goku với nhiều khớp nối và phụ kiện để tạo nhiều tư thế",
        category: createdCategories["Figma"],
        brand: createdBrands["Recast White Hole"],
        inventory: 40,
        scale: "Figma",
        series: "Dragon Ball Z",
        manufacturer: "Recast White Hole",
        material: "PVC, ABS",
        height: 14,
        releaseDate: "2024-05",
        character: "Son Goku",
        type: "Figma",
        color: "Xanh dương",
        weight: 0.25,
        images: [],
      },
      {
        title: "Miku Hatsune - Vocaloid Scale Figure 1/7",
        price: 4500000,
        promotion: 4200000,
        description: "Figure Miku cao cấp với base phát sáng và chi tiết tỉ mỉ",
        category: createdCategories["Scale Figure"],
        brand: createdBrands["TF Toys Recast White Hole"],
        inventory: 20,
        scale: "1/7",
        series: "Vocaloid",
        manufacturer: "TF Toys Recast White Hole",
        material: "PVC, ABS",
        height: 28,
        releaseDate: "2024-06",
        character: "Hatsune Miku",
        type: "Scale Figure",
        color: "Xanh ngọc",
        weight: 1.2,
        images: [],
      },
      {
        title: "Saber - Fate/stay night Scale Figure 1/7",
        price: 3800000,
        promotion: 3500000,
        description: "Figure Saber Alter với thiết kế đen tối và vũ khí Excalibur Morgan",
        category: createdCategories["Scale Figure"],
        brand: createdBrands["Recast TH"],
        inventory: 15,
        scale: "1/7",
        series: "Fate/stay night",
        manufacturer: "Recast TH",
        material: "PVC, ABS",
        height: 26,
        releaseDate: "2024-07",
        character: "Saber Alter",
        type: "Scale Figure",
        color: "Đen",
        weight: 0.9,
        images: [],
      },
      {
        title: "Tanjiro Kamado - Demon Slayer Prize Figure",
        price: 600000,
        promotion: 550000,
        description: "Prize Figure Tanjiro với giá cả hợp lý và chất lượng tốt",
        category: createdCategories["Prize Figure"],
        brand: createdBrands["Recast Queen Studio"],
        inventory: 80,
        scale: "Prize Figure",
        series: "Demon Slayer",
        manufacturer: "Recast Queen Studio",
        material: "PVC",
        height: 18,
        releaseDate: "2024-08",
        character: "Tanjiro Kamado",
        type: "Prize Figure",
        color: "Xanh lá",
        weight: 0.4,
        images: [],
      },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const productData of products) {
      // Kiểm tra xem product đã tồn tại chưa
      const existingProduct = await Product.findOne({ title: productData.title });
      if (existingProduct) {
        console.log(`   ℹ️  Product đã tồn tại: ${productData.title}`);
        skippedCount++;
        continue;
      }

      // Thêm createdBy
      productData.createdBy = adminUser._id;

      // Tạo product
      const product = await Product.create(productData);
      console.log(`   ✅ Đã tạo product: ${product.title}`);
      createdCount++;
    }

    console.log("\n📊 Tổng kết:");
    console.log(`   ✅ Đã tạo mới: ${createdCount} products`);
    console.log(`   ℹ️  Đã bỏ qua: ${skippedCount} products (đã tồn tại)`);
    console.log("\n✅ Seed data hoàn tất!\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi seed data:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

