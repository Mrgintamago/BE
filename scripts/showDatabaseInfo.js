const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://localhost:27017/tqn_figure_shop";

console.log("\n" + "=".repeat(70));
console.log("📊 THÔNG TIN DATABASE");
console.log("=".repeat(70));

mongoose
  .connect(DB)
  .then(async () => {
    const adminDb = mongoose.connection.db.admin();
    const dbName = mongoose.connection.db.databaseName;
    
    // Lấy danh sách tất cả databases
    const { databases } = await adminDb.listDatabases();
    
    console.log("\n🔗 Connection String:");
    console.log(`   ${DB}\n`);
    
    console.log("📁 Tất cả databases trong MongoDB:");
    databases.forEach((db, index) => {
      const sizeMB = (db.sizeOnDisk / 1024 / 1024).toFixed(2);
      const marker = db.name === dbName ? " 👈 (Đang dùng)" : "";
      console.log(`   ${index + 1}. ${db.name} (${sizeMB} MB)${marker}`);
    });
    
    console.log(`\n✅ Database hiện tại: ${dbName}`);
    
    // Liệt kê collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📦 Collections (${collections.length}):`);
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });
    
    // Đếm documents trong mỗi collection
    console.log("\n📊 Số lượng documents:");
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`   ${col.name}: ${count} documents`);
    }
    
    console.log("\n" + "=".repeat(70));
    console.log("💡 HƯỚNG DẪN KẾT NỐI MONGODB COMPASS:");
    console.log("=".repeat(70));
    console.log("\n1. Mở MongoDB Compass");
    console.log("2. Trong ô 'New Connection', nhập:");
    console.log(`   mongodb://127.0.0.1:27017`);
    console.log("3. Click 'Connect'");
    console.log(`4. Chọn database: ${dbName}`);
    console.log("\nHoặc kết nối trực tiếp:");
    console.log(`   mongodb://127.0.0.1:27017/${dbName}`);
    console.log("\n" + "=".repeat(70) + "\n");
    
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Lỗi:", err.message);
    console.log("\n💡 Kiểm tra:");
    console.log("   1. MongoDB có đang chạy không?");
    console.log("   2. Port 27017 có đúng không?");
    console.log("   3. Connection string có đúng không?");
    process.exit(1);
  });

