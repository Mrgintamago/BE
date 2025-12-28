const express = require("express");
const newsController = require("./../controllers/newsController");
const authController = require("./../controllers/authController");

const router = express.Router();

// Public routes - không cần đăng nhập
router.route("/").get(newsController.getAllNews);

// Route đặc biệt PHẢI đặt trước route :id để tránh conflict
// Xử lý authentication trong route này
router.get(
  "/getTableNews",
  authController.protect,
  authController.restrictTo("super_admin", "admin"),
  newsController.getTableNews
);

// Public route cho xem chi tiết bài viết - đặt sau /getTableNews
router.route("/:id").get(newsController.getNews);

// Protected routes - cần đăng nhập
router.use(authController.protect);

router
  .route("/")
  .post(
    authController.restrictTo("super_admin", "admin"),
    newsController.setAuthor,
    newsController.uploadNewsImages,
    newsController.resizeNewsImages,
    newsController.createNews
  );

router
  .route("/:id")
  .patch(
    authController.restrictTo("super_admin", "admin"),
    newsController.uploadNewsImages,
    newsController.resizeNewsImages,
    newsController.deleteNewsImages,
    newsController.updateNews
  )
  .delete(
    authController.restrictTo("super_admin", "admin"),
    newsController.deleteNewsImages,
    newsController.deleteNews
  );

module.exports = router;
