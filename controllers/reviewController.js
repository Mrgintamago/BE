const Review = require("./../models/reviewModel");
const Order = require("./../models/orderModel");
const factory = require("./handlerFactory");
const AppError = require("./../utils/appError");
const catchAsync = require("./../utils/catchAsync");

exports.setProductUserIds = catchAsync(async (req, res, next) => {
  // Allow nested routes
  if (!req.body.product) req.body.product = req.params.productId;
  if (!req.body.user) req.body.user = req.user.id;
  const data = await Order.find({ user: req.body.user });
  if (data[0] == undefined) {
    return next(
      new AppError(
        "Bạn chưa thể đánh giá lúc này.Vui lòng mua hàng trước khi đánh giá!!!",
        403
      )
    );
  }
  let kt = 0;
  await data.forEach(async (val, index) => {
    await val.cart.forEach((value, index) => {
      if (value.product._id == req.body.product && val.status == "Success") {
        kt = 1;
        return next();
      }
    });
  });
  if (kt == 0)
    return next(
      new AppError(
        "Bạn chưa thể đánh giá lúc này.Vui lòng mua hàng trước khi đánh giá!!!",
        403
      )
    );
});

// Create review for guest or logged-in user
exports.createReviewGuestOrUser = catchAsync(async (req, res, next) => {
  // Check if user is logged in
  let token;
  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }
  } catch (error) {
    // No token, proceed as guest
  }

  if (token) {
    // User is logged in, use existing flow
    try {
      const jwt = require("jsonwebtoken");
      const { promisify } = require("util");
      const User = require("./../models/userModel");
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      
      if (currentUser) {
        req.user = currentUser;
        // Check if user already reviewed this product
        if (!req.body.product) req.body.product = req.params.productId;
        const existingReview = await Review.findOne({
          product: req.body.product,
          user: currentUser._id,
        });
        
        if (existingReview) {
          return next(
            new AppError("Bạn đã đánh giá sản phẩm này rồi", 400)
          );
        }
        
        // Use existing middleware for logged-in users
        return exports.setProductUserIds(req, res, () => {
          exports.createReview(req, res, next);
        });
      }
    } catch (error) {
      // Token invalid, proceed as guest
    }
  }

  // Guest review - check if guest has successful order
  if (!req.body.product) req.body.product = req.params.productId;
  
  // Set default values if not provided
  if (!req.body.guestName) {
    req.body.guestName = null;
  }
  if (!req.body.guestEmail) {
    req.body.guestEmail = null;
  }

  // Check if guest has successful order for this product
  // Try to find order by email first, then by receiver + phone if email not provided
  let guestOrders = [];
  if (req.body.guestEmail && req.body.guestEmail.trim()) {
    guestOrders = await Order.find({ 
      email: req.body.guestEmail.trim(),
      status: "Success",
      user: null // Only guest orders
    });
  }
  
  // If no orders found by email, try by receiver + phone (if provided in review, though unlikely)
  // Actually, for guest reviews, we need email or phone to verify
  // For now, we'll require email for guest reviews to verify order
  
  if (guestOrders.length === 0) {
    // Try to find by phone if email not provided (but we need phone in request)
    // Since we don't have phone in review request, we'll require email for guest reviews
    if (!req.body.guestEmail || !req.body.guestEmail.trim()) {
      return next(
        new AppError("Vui lòng nhập email để xác minh đơn hàng đã giao thành công", 400)
      );
    }
    return next(
      new AppError(
        "Bạn chưa có đơn hàng giao thành công. Vui lòng mua hàng và đợi đơn hàng giao thành công trước khi đánh giá!!!",
        403
      )
    );
  }

  // Check if any order contains this product
  let hasProduct = false;
  for (const order of guestOrders) {
    for (const cartItem of order.cart) {
      const productId = cartItem.product?._id?.toString() || cartItem.product?.toString();
      if (productId === req.body.product.toString()) {
        hasProduct = true;
        break;
      }
    }
    if (hasProduct) break;
  }

  if (!hasProduct) {
    return next(
      new AppError(
        "Bạn chưa có đơn hàng giao thành công cho sản phẩm này. Vui lòng mua hàng và đợi đơn hàng giao thành công trước khi đánh giá!!!",
        403
      )
    );
  }

  // Create guest review
  req.body.user = null;
  exports.createReview(req, res, next);
});
exports.getTableReview = factory.getTable(Review);
exports.getAllReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = factory.createOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.isOwner = factory.checkPermission(Review);
