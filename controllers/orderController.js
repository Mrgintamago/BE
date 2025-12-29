const Order = require("./../models/orderModel");
const factory = require("./handlerFactory");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const moment = require("moment");
const logger = require("../utils/logger");
const mailTemplate = require("./mailTemplate");
const Product = require("../models/productModel");
const sendEmail = require("../utils/email");

// SECURITY: Input validation patterns
const validators = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^0\d{9,10}$/,
  address: /^.{5,200}$/, // 5-200 characters
};

exports.checkStatusOrder = catchAsync(async (req, res, next) => {
  // Kiểm tra quyền hủy đơn: User chỉ có thể hủy khi status = "Processed" hoặc "Waiting Goods"
  if (req.body.status === "Cancelled") {
    // Admin roles có thể hủy đơn ở bất kỳ trạng thái nào (trừ đã hủy và đã hoàn thành)
    const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
    if (adminRoles.includes(req.user.role)) {
      if (req.order.status === "Cancelled" || req.order.status === "Success") {
        return next(new AppError(`Đơn hàng này đã ${req.order.status === "Cancelled" ? "hủy" : "hoàn thành"}`, 403));
      }
      return next();
    }
    // User chỉ có thể hủy đơn khi status = "Processed" (Chờ xác nhận) hoặc "Waiting Goods" (Chờ lấy hàng)
    // Không được hủy khi đã bàn giao cho đơn vị vận chuyển (Delivery) trở đi
    if (req.order.status !== "Processed" && req.order.status !== "Waiting Goods") {
      if (req.order.status === "Delivery") {
        return next(new AppError("Không thể hủy đơn hàng đã được bàn giao cho đơn vị vận chuyển.", 403));
      }
      if (req.order.status === "Success") {
        return next(new AppError("Không thể hủy đơn hàng đã được giao.", 403));
      }
      if (req.order.status === "Cancelled") {
        return next(new AppError("Đơn hàng này đã được hủy.", 403));
      }
      return next(new AppError("Không thể hủy đơn hàng ở trạng thái này.", 403));
    }
    return next();
  }
  
  // User chỉ có thể hủy đơn, không thể thay đổi trạng thái khác
  if (
    req.user.role === "user" &&
    req.body.status !== "Cancelled"
  ) {
    return next(new AppError("Bạn không có quyền thực hiện.", 403));
  }
  
  // Không cho phép thay đổi trạng thái đơn hàng đã hủy hoặc đã hoàn thành
  if (req.order.status === "Cancelled" || req.order.status === "Success") {
    return next(new AppError(`Đơn hàng này đã ${req.order.status === "Cancelled" ? "hủy" : "hoàn thành"}`, 403));
  }
  next();
});
exports.getTableOrder = factory.getTable(Order);
exports.createOrder = factory.createOne(Order);
// Tạo đơn cho khách chưa đăng nhập (không gắn user)
exports.createOrderGuest = catchAsync(async (req, res, next) => {
  logger.log("🔵 [1] createOrderGuest called");
  logger.log("🔵 [2] req.body:", JSON.stringify(req.body, null, 2));
  
  // SECURITY: Input validation
  // Email: optional, but if provided must be valid
  if (req.body.email && !validators.email.test(req.body.email)) {
    logger.warn("❌ [VALIDATION] Email invalid:", req.body.email);
    return next(new AppError("Email không hợp lệ", 400));
  }
  logger.log("✅ [VALIDATION] Email OK (optional field)");
  
  if (!req.body.phone || !validators.phone.test(req.body.phone)) {
    logger.warn("❌ [VALIDATION] Phone invalid:", req.body.phone);
    return next(new AppError("Số điện thoại không hợp lệ (phải là 10-11 chữ số bắt đầu từ 0)", 400));
  }
  logger.log("✅ [VALIDATION] Phone OK");
  
  if (!req.body.address || !validators.address.test(req.body.address)) {
    logger.warn("❌ [VALIDATION] Address invalid:", req.body.address);
    return next(new AppError("Địa chỉ không hợp lệ (5-200 ký tự)", 400));
  }
  logger.log("✅ [VALIDATION] Address OK");
  
  if (!req.body.receiver || req.body.receiver.trim().length < 2) {
    logger.warn("❌ [VALIDATION] Receiver invalid:", req.body.receiver);
    return next(new AppError("Tên người nhận không hợp lệ", 400));
  }
  logger.log("✅ [VALIDATION] Receiver OK");
  
  if (!req.body.cart || !Array.isArray(req.body.cart) || req.body.cart.length === 0) {
    logger.warn("❌ [VALIDATION] Cart invalid:", req.body.cart);
    return next(new AppError("Giỏ hàng không hợp lệ", 400));
  }
  logger.log("✅ [VALIDATION] Cart OK");
  
  // Kiểm tra số lượng sản phẩm không vượt quá tồn kho
  try {
    for (const item of req.body.cart) {
      const product = await Product.findById(item.product);
      if (!product) {
        logger.warn("❌ [VALIDATION] Product not found:", item.product);
        return next(new AppError(`Sản phẩm không tồn tại: ${item.product}`, 400));
      }
      if (item.quantity > product.quantity) {
        logger.warn("❌ [VALIDATION] Insufficient inventory:", {
          productId: item.product,
          requested: item.quantity,
          available: product.quantity
        });
        return next(new AppError(`Sản phẩm "${product.title}" chỉ còn ${product.quantity} cái, không thể mua ${item.quantity} cái`, 400));
      }
    }
    logger.log("✅ [VALIDATION] Inventory OK for all products");
  } catch (err) {
    if (err.message && err.message.includes("Sản phẩm")) {
      return next(err);
    }
    logger.error("❌ [VALIDATION] Error checking inventory:", err.message);
    return next(new AppError("Lỗi kiểm tra tồn kho", 500));
  }
  
  if (!req.body.totalPrice || typeof req.body.totalPrice !== 'number' || req.body.totalPrice <= 0) {
    logger.warn("❌ [VALIDATION] Price invalid:", req.body.totalPrice);
    return next(new AppError("Tổng giá không hợp lệ", 400));
  }
  logger.log("✅ [VALIDATION] Price OK");
  
  // SECURITY: Validate payment method
  const validPaymentMethods = ["tiền mặt", "payos"];
  if (!req.body.payments || !validPaymentMethods.includes(req.body.payments)) {
    logger.warn("❌ [VALIDATION] Payment method invalid:", req.body.payments);
    return next(new AppError("Phương thức thanh toán không hợp lệ (tiền mặt hoặc payos)", 400));
  }
  logger.log("✅ [VALIDATION] Payments OK:", req.body.payments);
  
  try {
    logger.log("🔵 [3] All validations passed, creating order...");
    const doc = await Order.create({
      ...req.body,
      user: null,
    });
    logger.log("✅ [4] Order created successfully:", doc._id);
    
    // Gửi mail xác nhận cho khách không đăng nhập (chỉ khi thanh toán tiền mặt - PayOS sẽ gửi sau khi webhook confirm)
    try {
      if (req.body.email && req.body.payments === "tiền mặt") {
        const domain = `https://tqn.onrender.com`;
        const message = mailTemplate(doc, domain);
        await sendEmail({
          email: req.body.email,
          subject: "Xác nhận đặt hàng thành công",
          message,
        });
        logger.log("✅ [5] Confirmation email sent to:", req.body.email);
      }
    } catch (err) {
      logger.log("⚠️ [5] Email error (non-blocking):", err.message);
      // Email error không gây lỗi chính, tiếp tục trả về order
    }

    logger.log("✅ [6] Returning order response");
    res.status(201).json({
      status: "success",
      data: doc,
    });
  } catch (err) {
    logger.error("❌ [ERROR] Exception creating order:", err.message);
    logger.error("❌ [ERROR] Full stack:", err);
    return next(new AppError(`Lỗi tạo đơn hàng: ${err.message}`, 500));
  }
});

// SECURITY: Get order - public endpoint (no auth required) for payment verification
// Guest orders (user=null) can be accessed without auth
exports.getOrder = async (req, res, next) => {
  try {
    logger.log("🔵 [getOrder] Called with ID:", req.params.id);
    
    const doc = await Order.findById(req.params.id);
    logger.log("🔵 [getOrder] Order found:", doc ? "YES" : "NO");
    
    if (!doc) {
      logger.error("❌ [getOrder] Order not found");
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy dữ liệu với ID này",
      });
    }
    
    logger.log("🔵 [getOrder] User authenticated:", !!req.user);
    
    // For authenticated users, check ownership
    if (req.user) {
      const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
      const isAdmin = adminRoles.includes(req.user?.role);
      const isOwner = doc.user?._id?.toString() === req.user?._id?.toString();
      
      logger.log("🔵 [getOrder] isAdmin:", isAdmin, "isOwner:", isOwner);
      
      if (!isAdmin && !isOwner) {
        logger.error("❌ [getOrder] User not authorized");
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền xem đơn hàng này",
        });
      }
    }
    // If no user authenticated, allow access (public endpoint)
    
    logger.log("✅ [getOrder] Returning order:", doc._id);
    return res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  } catch (err) {
    logger.error("❌ [getOrder] Exception:", err.message);
    logger.error("❌ [getOrder] Stack:", err.stack);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

exports.getAllOrders = factory.getAll(Order);
exports.updateOrder = catchAsync(async (req, res, next) => {
  if (req.body.status == "Cancelled") {
    const cart = req.order.cart;
    for (const value of cart) {
      await Product.findByIdAndUpdate(value.product._id, {
        $inc: { inventory: value.quantity },
      });
    }
  }
  const doc = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!doc) {
    return next(new AppError("Không tìm thấy dữ liệu với ID này", 404));
  }
  try {
    if (doc?.user?.email) {
      const domain = `https://tqn.onrender.com`;
      const message = mailTemplate(doc, domain);
      await sendEmail({
        email: doc.user.email,
        subject: "Cập nhật trạng thái đơn hàng",
        message,
      });
    }
  } catch (err) {
    logger.log(err);
  } finally {
    return res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  }
});
exports.deleteOrder = factory.deleteOne(Order);
exports.isOwner = factory.checkPermission(Order);
exports.setUser = (req, res, next) => {
  logger.log("🔵 createOrder - req.body before setUser:", req.body);
  if (!req.body.user) req.body.user = req.user;
  logger.log("🔵 createOrder - req.body after setUser:", req.body);
  next();
};
exports.countStatus = catchAsync(async (req, res, next) => {
  const data = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  res.status(200).json(data);
});

exports.countStatusOption = catchAsync(async (req, res, next) => {
  const option = {
    status: "$status",
  };
  if (req.body.year) option.year = { $year: "$createdAt" };
  if (req.body.month) option.month = { $month: "$createdAt" };
  if (req.body.week) option.week = { $week: "$createdAt" };
  if (req.body.date) option.date = { $dayOfWeek: "$createdAt" };
  const data = await Order.aggregate([
    {
      $group: {
        _id: option,
        count: { $sum: 1 },
      },
    },
  ]);
  res.status(200).json(data);
});
exports.sumRevenueOption = catchAsync(async (req, res, next) => {
  const option = {};
  if (req.body.year) option.year = { $year: "$createdAt" };
  if (req.body.month) option.month = { $month: "$createdAt" };
  if (req.body.week) option.week = { $week: "$createdAt" };
  if (req.body.date) option.date = { $dayOfWeek: "$createdAt" };
  const data = await Order.aggregate([
    {
      $match: { status: "Success" },
    },
    {
      $group: {
        _id: option,
        total_revenue: { $sum: "$totalPrice" },
        // bookings_month: {
        //   $push: {
        //     each_order: "$totalPrice",
        //   },
        // },
      },
    },
  ]);
  res.status(200).json(data);
});
exports.sumRevenue = catchAsync(async (req, res, next) => {
  const data = await Order.aggregate([
    {
      $match: { status: "Success" },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        total_revenue_month: { $sum: "$totalPrice" },
        // bookings_month: {
        //   $push: {
        //     each_order: "$totalPrice",
        //   },
        // },
      },
    },
  ]);
  res.status(200).json(data);
});
exports.topProduct = catchAsync(async (req, res, next) => {
  const option = {
    product: "$cart.product.id",
  };
  if (req.body.year) option.year = { $year: "$createdAt" };
  if (req.body.month) option.month = { $month: "$createdAt" };
  if (req.body.week) option.week = { $week: "$createdAt" };
  if (req.body.date) option.date = { $dayOfWeek: "$createdAt" };

  const data = await Order.aggregate([
    {
      $unwind: "$cart",
    },
    {
      $match: { status: "Success" },
    },
    {
      $group: {
        _id: option,
        quantity: { $sum: "$cart.quantity" },
        title: { $first: "$cart.product.title" },
        image: { $first: "$cart.product.images" },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
  ]);
  res.status(200).json(data);
});

exports.countStatusInRange = catchAsync(async (req, res, next) => {
  const dateFrom = req.body.dateFrom;
  const dateTo = req.body.dateTo;
  const option = {
    status: "$status",
  };
  let dateStart = new Date(dateFrom);
  dateStart;
  let dateEnd = new Date(dateTo);
  dateStart.setUTCHours(0, 0, 0, 0);
  dateEnd.setUTCHours(23, 59, 59, 999);
  const data = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: moment.utc(dateStart).toDate(),
          $lt: moment.utc(dateEnd).toDate(),
        },
      },
    },
    {
      $group: {
        _id: option,
        count: { $sum: 1 },
      },
    },
  ]);
  res.status(200).json(data);
});
exports.topProductInRange = catchAsync(async (req, res, next) => {
  const option = {
    product: "$cart.product.id",
  };
  const dateFrom = req.body.dateFrom;
  const dateTo = req.body.dateTo;
  let dateStart = new Date(dateFrom);
  dateStart;
  let dateEnd = new Date(dateTo);
  dateStart.setUTCHours(0, 0, 0, 0);
  dateEnd.setUTCHours(23, 59, 59, 999);
  const data = await Order.aggregate([
    {
      $unwind: "$cart",
    },
    {
      $match: {
        status: "Success",
        createdAt: {
          $gte: moment.utc(dateStart).toDate(),
          $lt: moment.utc(dateEnd).toDate(),
        },
      },
    },
    {
      $group: {
        _id: option,
        quantity: { $sum: "$cart.quantity" },
        title: { $first: "$cart.product.title" },
        image: { $first: "$cart.product.images" },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
  ]);
  res.status(200).json(data);
});
exports.sumInRange = catchAsync(async (req, res, next) => {
  const dateFrom = req.body.dateFrom;
  const dateTo = req.body.dateTo;
  let dateStart = new Date(dateFrom);
  dateStart;
  let dateEnd = new Date(dateTo);
  dateStart.setUTCHours(0, 0, 0, 0);
  dateEnd.setUTCHours(23, 59, 59, 999);
  const data = await Order.aggregate([
    {
      $match: {
        status: "Success",
        createdAt: {
          $gte: moment.utc(dateStart).toDate(),
          $lt: moment.utc(dateEnd).toDate(),
        },
      },
    },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: "$totalPrice" },
        // bookings_month: {
        //   $push: {
        //     each_order: "$totalPrice",
        //   },
        // },
      },
    },
  ]);
  res.status(200).json(data);
});
