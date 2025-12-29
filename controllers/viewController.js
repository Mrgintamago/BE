const jwt = require("jsonwebtoken");
const User = require("./../models/userModel");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const factory = require("./handlerFactory");
const logger = require("../utils/logger");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
const googleRedirect = (user, res) => {
  const token = signToken(user._id);
  logger.log(token);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  logger.log(cookieOptions);
  res.cookie("jwt", token, cookieOptions);
  res.locals.user = user;

  return res.redirect("/");
};
exports.errorPage = (req, res, next) => {
  if (res.locals.user == undefined) {
    return res.redirect("/login");
  }
  // Allow access for all admin roles
  const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
  if (!adminRoles.includes(res.locals.user.role)) {
    return res.redirect("/error");
  }
  next();
};
exports.alreadyLoggedIn = (req, res, next) => {
  const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
  if (res.locals.user != undefined && adminRoles.includes(res.locals.user.role))
    return res.redirect("/");
  next();
};
exports.googleLogin = catchAsync(async (req, res) => {
  const { email_verified, name, email, picture } = req.user;
  if (email_verified) {
    // 1) Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect("/login");
    }
    
    // 2) Check if user is banned
    if (user.active == "ban") {
      return res.redirect("/login?error=banned");
    }
    
    // 3) Check if user has admin role
    const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
    if (adminRoles.includes(user.role)) {
      googleRedirect(user, res);
    }
    // 4) If user does not have admin role
    else {
      return res.redirect("/login");
    }
  }
});
