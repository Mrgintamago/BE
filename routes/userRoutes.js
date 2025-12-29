const express = require("express");
const userController = require("./../controllers/userController");
const authController = require("./../controllers/authController");

const router = express.Router();
router.post("/googleLogin", authController.googleLogin);
router.post("/userLoginWith", authController.userLoginWith);
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/verifyResetPass", authController.verifyResetPass);
router.post("/verify", authController.verifyUser);
// SECURITY: Refresh token endpoint (before protect middleware)
router.post("/refreshToken", authController.refreshAccessToken);
router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);
router.patch("/changeState", authController.changeStateUser);

// Protect all routes after this middleware
router.use(authController.protect);

// SPECIFIC ROUTES - must be BEFORE generic /:id routes
// Logout AFTER protect - ensure we have user context and valid token
router.post("/logout", authController.logout);

router.patch("/updateMyPassword", authController.updatePassword);
router.get("/me", userController.getMe, userController.getUser);  
router.patch("/updateMe", userController.updateMe);
router.delete("/deleteMe", userController.deleteMe);
router.get("/me/address", userController.getUserAddress);  
router.patch("/createAddress", userController.createAddress);
router.patch("/updateAddress", userController.updateAddress);
router.patch("/setDefaultAddress", userController.setDefaultAddress);
router.patch("/deleteAddress", userController.deleteAddress);

router.route("/getTableUser").get(
  authController.restrictTo("super_admin", "admin"),
  userController.getTableUser
);

router.route("/getTableAdminUsers").get(
  authController.restrictTo("super_admin"),
  userController.getTableAdminUsers
);

router.route("/getTableCustomerUsers").get(
  authController.restrictTo("super_admin", "admin", "sales_staff"),
  userController.getTableCustomerUsers
);

router
  .route("/admin-users")
  .get(authController.restrictTo("super_admin"), userController.getAllAdminUsers);

router
  .route("/admin-users/:id")
  .get(authController.restrictTo("super_admin"), userController.getUser)
  .patch(authController.restrictTo("super_admin"), userController.updateUser)
  .delete(authController.restrictTo("super_admin"), userController.deleteUser);

router
  .route("/admin-users/:id/updatePassword")
  .patch(
    authController.restrictTo("super_admin"),
    userController.updateUserPassword
  );

router
  .route("/customer-users")
  .get(authController.restrictTo("super_admin", "admin", "sales_staff"), userController.getAllCustomerUsers);

router
  .route("/customer-users/:id")
  .get(authController.restrictTo("super_admin", "admin", "sales_staff"), userController.getUser)
  .patch(authController.restrictTo("super_admin"), userController.updateUser)
  .delete(authController.restrictTo("super_admin"), userController.deleteUser);

router
  .route("/customer-users/:id/updatePassword")
  .patch(
    authController.restrictTo("super_admin"),
    userController.updateUserPassword
  );

// GENERIC ROUTES - must be LAST
// Legacy routes (keep for backward compatibility)
router
  .route("/")
  .get(authController.restrictTo("super_admin", "admin", "manager", "sales_staff"), userController.getAllUsers)
  .post(authController.restrictTo("super_admin"), userController.createUser);

// Generic /:id route - MUST be last to not match specific routes like /logout
// Use regex to only match valid ObjectIds, not string literals
router
  .route("/:id(^[0-9a-fA-F]{24}$)")
  .get(authController.restrictTo("super_admin", "admin", "sales_staff"), userController.getUser)
  .patch(authController.restrictTo("super_admin"), userController.updateUser)
  .delete(authController.restrictTo("super_admin"), userController.deleteUser);

// Route to update user password (Super Admin only)
router
  .route("/:id(^[0-9a-fA-F]{24}$)/updatePassword")
  .patch(
    authController.restrictTo("super_admin"),
    userController.updateUserPassword
  );

module.exports = router;
