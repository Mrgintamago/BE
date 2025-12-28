const express = require("express");
const categoryController = require("./../controllers/categoryController");
const authController = require("./../controllers/authController");

const router = express.Router();

// Route public để lấy danh sách categories (cho trang product listing)
router
  .route("/")
  .get(categoryController.getAllCategories);

// Các route yêu cầu đăng nhập
router.use(authController.protect);
router.route("/getTableCategory").get(
  authController.restrictTo("super_admin", "admin"),
  categoryController.getTableCategory
);

router
  .route("/")
  .post(
    authController.restrictTo("super_admin", "admin"),
    categoryController.createCategory
  );

router
  .route("/:id")
  .get(categoryController.getCategory)
  .patch(
    authController.restrictTo("super_admin", "admin"),
    categoryController.updateCategory
  )
  .delete(
    authController.restrictTo("super_admin", "admin"),
    categoryController.deleteCategory
  );

module.exports = router;
