const express = require("express");
// const AppError = require("./../utils/appError");
// const catchAsync = require("./../utils/catchAsync");
// const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const viewController = require("../controllers/viewController");
const Order = require("../models/orderModel");
const passport = require("../utils/passport");

const router = express.Router();
router.use(authController.isLoggedIn);

router.get("/login", viewController.alreadyLoggedIn, (req, res, next) => {
  res.status(200).render("login",{title: "Login"});
});

router.get("/error", (req, res, next) => {
  res.status(403).render("404", {title: "Access Denied"});
});

router.use(viewController.errorPage);

// Helper function to check role
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!res.locals.user) {
      return res.redirect("/login");
    }
    if (!allowedRoles.includes(res.locals.user.role)) {
      return res.status(403).render("404", {title: "Access Denied"});
    }
    next();
  };
};

router.get("/", (req, res, next) => {
  res.status(200).render("dashboard",{title:"Dashboard"});
});
router.get("/analytics", checkRole("super_admin", "admin", "manager"), (req, res, next) => {
  res.status(200).render("analytic",{title:"Analytics"});
});
// Legacy route - keep for backward compatibility
router.get("/users", checkRole("super_admin", "admin"), (req, res, next) => {
  res.status(200).render("user",{title:"Manage User"});
});
// Admin Users - Only Super Admin can access
router.get("/admin-users", checkRole("super_admin"), (req, res, next) => {
  res.status(200).render("adminUsers",{title:"Quản lý Admin Users"});
});
// Customer Users - Super Admin, Admin, and Sales Staff can access
router.get("/customer-users", checkRole("super_admin", "admin", "sales_staff"), (req, res, next) => {
  res.status(200).render("customerUsers",{title:"Quản lý Customer Users"});
});
router.get("/products", checkRole("super_admin", "admin"), (req, res, next) => {
  res.status(200).render("product",{title:"Manage Product"});
});
router.get("/orders", checkRole("super_admin", "admin", "manager", "sales_staff"), (req, res, next) => {
  res.status(200).render("order",{title:"Manage Order"});
});
router.get("/orders/:id", checkRole("super_admin", "admin", "manager", "sales_staff"), async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await Order.findById(id).populate({
      path: "user",
      select: "name email",
    });
    if (!data) {
      return res.status(200).render("404");
    }
    let subTotal = 0;
    data.cart.forEach((value) => {
      const unit =
        typeof value.product.promotion === "number" &&
        value.product.promotion > 0
          ? value.product.promotion
          : value.product.price;
      subTotal += unit * value.quantity;
    });
    data.subTotal = subTotal;
    data.shippingFee = data.totalPrice - subTotal;
    data.discount = 0;
    if (data.shippingFee < 0) data.shippingFee = 0;
    const theDate = new Date(Date.parse(data.createdAt));
    const date = theDate.toLocaleString();
    data.date = date;
    res.status(200).render("orderDetail", { data ,title:"Order Detail"});
  } catch (error) {
    res.status(200).render("404");
  }
});
router.get("/brands", checkRole("super_admin", "admin"), (req, res, next) => {
  res.status(200).render("brand",{title:"Manage Brand"});
});
router.get("/categories", checkRole("super_admin", "admin"), (req, res, next) => {
  res.status(200).render("category" ,{title:"Manage Category"});
});
router.get("/reviews", checkRole("super_admin", "admin"), (req, res, next) => {
  res.status(200).render("review",{title:"Manage Review"});
});
router.get("/news", checkRole("super_admin", "admin", "sales_staff"), (req, res, next) => {
  res.status(200).render("news",{title:"Manage News & Articles"});
});
router.get("/partner-registrations", checkRole("super_admin", "admin", "manager", "sales_staff"), (req, res, next) => {
  res.status(200).render("partnerRegistration",{title:"Quản lý Đăng ký Đối tác"});
});

module.exports = router;
