const express = require("express");
const orderController = require("./../controllers/orderController");
const authController = require("./../controllers/authController");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const Order = require("./../models/orderModel");

const router = express.Router();

// Tạo đơn cho khách (không cần đăng nhập)
router.route("/guest").post(orderController.createOrderGuest);

// Các route yêu cầu đăng nhập
router.use(authController.protect);
router
  .route("/getTableOrder")
  .get(
    authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
    orderController.getTableOrder
  );

router
  .route("/")
  .get(orderController.getAllOrders)
  .post(
    authController.restrictTo("user"),
    orderController.setUser,
    orderController.createOrder
  );
// Analytics routes - accessible by all admin roles
router.route("/count").get(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.countStatus
);
router.route("/countOption").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.countStatusOption
);
router.route("/sum").get(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.sumRevenue
);
router.route("/sumOption").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.sumRevenueOption
);
router.route("/topProduct").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.topProduct
);
router.route("/statusInRange").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.countStatusInRange
);
router.route("/topProductInRange").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.topProductInRange
);
router.route("/sumInRange").post(
  authController.restrictTo("super_admin", "admin", "manager", "sales_staff"),
  orderController.sumInRange
);
router
  .route("/:id")
  .get(orderController.isOwner, orderController.getOrder)
  .patch(
    // Cho phép admin roles và owner cập nhật đơn
    catchAsync(async (req, res, next) => {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return next(new AppError("Không tìm thấy đơn hàng", 404));
      }
      // Kiểm tra nếu user là admin role hoặc là owner của đơn
      const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
      const isAdmin = adminRoles.includes(req.user.role);
      
      // So sánh user ID - xử lý cả trường hợp order.user là object hoặc ObjectId
      let orderUserId;
      if (order.user) {
        orderUserId = order.user._id ? order.user._id.toString() : order.user.toString();
      }
      const currentUserId = req.user._id.toString();
      const isOwner = orderUserId === currentUserId;
      
      console.log(`[PATCH ORDER] Admin: ${isAdmin}, OrderUserId: ${orderUserId}, CurrentUserId: ${currentUserId}, isOwner: ${isOwner}`);
      
      if (!isAdmin && !isOwner) {
        return next(new AppError("Bạn không có quyền cập nhật đơn hàng này", 403));
      }
      
      req.order = order;
      next();
    }),
    orderController.checkStatusOrder,
    orderController.updateOrder
  );

module.exports = router;
