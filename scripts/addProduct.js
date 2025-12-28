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
    addProduct();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

async function addProduct() {
  try {
    // Lấy thông tin từ command line hoặc sử dụng giá trị mặc định
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log("\n📝 Hướng dẫn sử dụng:");
      console.log("   node scripts/addProduct.js [options]");
      console.log("\n   Options:");
      console.log("     --title \"Tên sản phẩm\" (bắt buộc, tối thiểu 10 ký tự)");
      console.log("     --price 10000000 (bắt buộc)");
      console.log("     --promotion 9000000 (tùy chọn)");
      console.log("     --description \"Mô tả sản phẩm\" (tùy chọn)");
      console.log("     --category \"Tên category\" (bắt buộc)");
      console.log("     --brand \"Tên brand\" (bắt buộc)");
      console.log("     --inventory 100 (tùy chọn, mặc định 0)");
      console.log("     --color \"Đen\" (tùy chọn)");
      console.log("     --scale \"1/7\" (tùy chọn - tỷ lệ figure)");
      console.log("     --series \"One Piece\" (tùy chọn - series/anime)");
      console.log("     --manufacturer \"Good Smile Company\" (tùy chọn)");
      console.log("     --material \"PVC, ABS\" (tùy chọn)");
      console.log("     --height 25 (tùy chọn - chiều cao cm)");
      console.log("     --releaseDate \"2024-03\" (tùy chọn)");
      console.log("     --character \"Luffy\" (tùy chọn - tên nhân vật)");
      console.log("     --type \"Scale Figure\" (tùy chọn)");
      console.log("     --weight 0.8 (tùy chọn - kg)");
      console.log("     --images \"url1,url2,url3\" (tùy chọn, phân cách bằng dấu phẩy)");
      console.log("\n   Ví dụ:");
      console.log('     node scripts/addProduct.js --title "Monkey D. Luffy Scale Figure 1/7" --price 3500000 --promotion 3200000 --category "Scale Figure" --brand "Good Smile Company" --inventory 30 --scale "1/7" --series "One Piece" --character "Monkey D. Luffy" --height 25');
      process.exit(0);
    }

    // Parse arguments
    const productData = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace("--", "");
      const value = args[i + 1];
      if (key && value) {
        productData[key] = value;
      }
    }

    // Validate required fields
    if (!productData.title || productData.title.length < 10) {
      console.error("\n❌ Lỗi: Title là bắt buộc và phải có ít nhất 10 ký tự!");
      process.exit(1);
    }

    if (!productData.price) {
      console.error("\n❌ Lỗi: Price là bắt buộc!");
      process.exit(1);
    }

    if (!productData.category) {
      console.error("\n❌ Lỗi: Category là bắt buộc!");
      process.exit(1);
    }

    if (!productData.brand) {
      console.error("\n❌ Lỗi: Brand là bắt buộc!");
      process.exit(1);
    }

    // Tìm category và brand
    const category = await Category.findOne({ name: new RegExp(productData.category, "i") });
    if (!category) {
      console.error(`\n❌ Không tìm thấy category: ${productData.category}`);
      console.log("\n📋 Danh sách categories có sẵn:");
      const categories = await Category.find().select("name");
      categories.forEach(cat => console.log(`   - ${cat.name}`));
      process.exit(1);
    }

    const brand = await Brand.findOne({ name: new RegExp(productData.brand, "i") });
    if (!brand) {
      console.error(`\n❌ Không tìm thấy brand: ${productData.brand}`);
      console.log("\n📋 Danh sách brands có sẵn:");
      const brands = await Brand.find().select("name");
      brands.forEach(b => console.log(`   - ${b.name}`));
      process.exit(1);
    }

    // Tìm admin user để làm createdBy
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      console.error("\n❌ Không tìm thấy admin user!");
      process.exit(1);
    }

    // Chuẩn bị dữ liệu sản phẩm
    const newProduct = {
      title: productData.title,
      price: parseFloat(productData.price),
      promotion: productData.promotion ? parseFloat(productData.promotion) : undefined,
      description: productData.description || "",
      category: category._id,
      brand: brand._id,
      createdBy: adminUser._id,
      inventory: productData.inventory ? parseInt(productData.inventory) : 0,
      color: productData.color || "",
      scale: productData.scale || "",
      series: productData.series || "",
      manufacturer: productData.manufacturer || "",
      material: productData.material || "",
      height: productData.height ? parseFloat(productData.height) : undefined,
      releaseDate: productData.releaseDate || "",
      character: productData.character || "",
      type: productData.type || "",
      weight: productData.weight ? parseFloat(productData.weight) : undefined,
      images: productData.images ? productData.images.split(",").map(url => url.trim()) : [],
    };

    // Tạo sản phẩm
    const product = await Product.create(newProduct);

    console.log("\n✅ Đã thêm sản phẩm thành công!");
    console.log(`   ID: ${product._id}`);
    console.log(`   Title: ${product.title}`);
    console.log(`   Price: ${product.price.toLocaleString("vi-VN")} VNĐ`);
    if (product.promotion) {
      console.log(`   Promotion: ${product.promotion.toLocaleString("vi-VN")} VNĐ`);
    }
    console.log(`   Category: ${category.name}`);
    console.log(`   Brand: ${brand.name}`);
    console.log(`   Inventory: ${product.inventory}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Lỗi khi thêm sản phẩm:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

