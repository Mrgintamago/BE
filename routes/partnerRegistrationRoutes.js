const express = require("express");
const partnerRegistrationController = require("./../controllers/partnerRegistrationController");
const authController = require("./../controllers/authController");

const router = express.Router();

router
  .route("/")
  .get(
    authController.protect,
    authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
    partnerRegistrationController.getAllPartnerRegistrations
  )
  .post(partnerRegistrationController.createPartnerRegistration); // Public endpoint for registration

router
  .route("/table")
  .get(
    authController.protect,
    authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
    partnerRegistrationController.getTablePartnerRegistration
  );

router
  .route("/:id")
  .get(
    authController.protect,
    authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
    partnerRegistrationController.getPartnerRegistration
  )
  .patch(
    authController.protect,
    authController.restrictTo("super_admin", "admin", "manager"), // Manager can approve
    partnerRegistrationController.updatePartnerRegistration
  )
  .delete(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    partnerRegistrationController.deletePartnerRegistration
  );

module.exports = router;

