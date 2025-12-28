const express = require("express");
const brandController = require("./../controllers/brandController");
const authController = require("./../controllers/authController");

const router = express.Router();

router.route("/getTableBrand").get(
  authController.protect,
  authController.restrictTo("super_admin", "admin"),
  brandController.getTableBrand
);

router
  .route("/")
  .get(brandController.getAllBrands)
  .post(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    brandController.createBrand
  );

router
  .route("/:id")
  .get(brandController.getBrand)
  .patch(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    brandController.updateBrand
  )
  .delete(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    brandController.deleteBrand
  );

module.exports = router;
