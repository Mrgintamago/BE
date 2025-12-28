const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const { connect } = require("getstream");
const User = require("./../models/userModel");
const Review = require("./../models/reviewModel");
const Order = require("./../models/orderModel");
const TokenBlacklist = require("./../models/tokenBlacklistModel");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const sendEmail = require("./../utils/email");

// SECURITY: Simple password validation function
const validatePasswordStrength = (password) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return minLength && hasUppercase && hasLowercase && hasNumbers && hasSymbols;
};

const api_key = process.env.STREAM_API_KEY;
const api_secret = process.env.STREAM_API_SECRET;
const app_id = process.env.STREAM_APP_ID;

// Validate Stream Chat credentials
const hasStreamCredentials = api_key && 
                             api_secret && 
                             app_id && 
                             api_secret !== "your_stream_api_secret" && 
                             api_secret.trim() !== "" &&
                             app_id !== "your_stream_app_id" && 
                             app_id.trim() !== "";

if (!hasStreamCredentials) {
  console.warn("⚠️  Stream Chat credentials are missing or not configured!");
  console.warn("   Please set STREAM_API_KEY, STREAM_API_SECRET, and STREAM_APP_ID in config.env");
  console.warn("   Get your credentials from: https://dashboard.getstream.io/");
  console.warn("   Chat functionality may not work properly until configured.");
}

// SECURITY: Dual-token system (Access + Refresh)
const signAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30m", // 30 minutes (user requirement)
  });
};

const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: "7d", // 7 days
  });
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const changeState = async (user, state, statusCode, res) => {
  user.active = state;
  const message = "Cập nhật trạng thái user thành công!!!";
  await user.save({ validateBeforeSave: false });
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    data: {
      user,
    },
    message,
  });
};
exports.changeStateUser = catchAsync(async (req, res, next) => {
  // 1) get token from cookie and state update to user
  const token = req.cookies.jwt;
  const state = req.body.state;
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }
  changeState(currentUser, state, 200, res);
});
const createSendToken = async (user, statusCode, res) => {
  // SECURITY: Use dual-token system
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  
  // SECURITY: HTTPOnly Secure Cookies for Refresh Token
  // Development: allow localhost (secure: false, sameSite: lax)
  // Production: HTTPS only (secure: true, sameSite: strict)
  const refreshCookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Prevents XSS access
    secure: process.env.NODE_ENV === "production", // HTTPS only in production, allow localhost in dev
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Relax for development
    path: "/",
  };
  
  // Set refresh token in HTTPOnly cookie
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  
  // Optional: Also keep jwt cookie for backward compatibility (with access token)
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  };
  res.cookie("jwt", accessToken, cookieOptions);
  
  res.locals.user = user;

  // Remove password from output
  user.password = undefined;
  
  console.log(`[CREATE_SEND_TOKEN] User role before send:`, {
    email: user.email,
    role: user.role,
    roleType: typeof user.role
  });

  // Create Stream Chat token if credentials are available
  let tokenStream = null;
  if (api_key && api_secret && app_id) {
    try {
      const serverClient = connect(api_key, api_secret, app_id);
      tokenStream = serverClient.createUserToken(user._id.toString());
    } catch (error) {
      console.error("Error creating Stream Chat token:", error.message);
    }
  }

  res.status(statusCode).json({
    status: "success",
    accessToken, // Send access token in response body for header usage
    refreshToken, // Optionally send refresh token (but it's also in cookie)
    data: {
      user,
    },
    tokenStream,
  });
};

const sendVerifyToken = catchAsync(async (user, statusCode, res) => {
  // 1) create token to verify
  const verifyToken = user.createVerifyToken();
  await user.save({ validateBeforeSave: false });
  // 2) create cookie to client
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);
  res.locals.user = user;

  // Remove password from output
  user.password = undefined;

  // Create Stream Chat token if credentials are available
  let tokenStream = null;
  if (hasStreamCredentials) {
    try {
      const serverClient = connect(api_key, api_secret, app_id);
      tokenStream = serverClient.createUserToken(user._id.toString());
    } catch (error) {
      console.error("Error creating Stream Chat token:", error.message);
      // Continue without Stream token if there's an error
    }
  }

  // 3) Send it to user's email
  const verifyURL = `https://tqn.onrender.com/verify`;
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d32f2f;">Xác nhận tài khoản TQN Figure</h2>
      <p>Xin chào,</p>
      <p>Bạn vừa đăng ký tài khoản tại TQN Figure. Vui lòng xác nhận tài khoản bằng mã xác nhận bên dưới:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
        <h1 style="color: #d32f2f; font-size: 32px; letter-spacing: 5px; margin: 0;">${verifyToken}</h1>
      </div>
      <p>Hoặc truy cập trực tiếp: <a href="${verifyURL}" style="color: #d32f2f;">${verifyURL}</a></p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">Nếu bạn không phải là người đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 11px;">© 2024 TQN Figure. All rights reserved.</p>
    </div>
  `;
  try {
    await sendEmail({
      email: user.email,
      subject: "verify User",
      message,
    });
    res.status(statusCode).json({
      status: "success",
      token,
      tokenStream,
      data: {
        user,
      },
      message: "Token sent to email!",
    });
  } catch (err) {
    console.log(err);
    // Still return response even if email fails
    res.status(statusCode).json({
      status: "success",
      token,
      tokenStream,
      data: {
        user,
      },
      message: "Token sent to email!",
    });
  }
});

exports.resendVerifyCode = catchAsync(async (req, res, next) => {
  // Get user from token (already authenticated by protect middleware)
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("Không tìm thấy người dùng", 404));
  }
  if (user.active !== "verify") {
    return next(new AppError("Tài khoản đã được xác thực", 400));
  }
  // Resend verification code
  sendVerifyToken(user, 200, res);
});

exports.verifyUser = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.encode)
    .digest("hex");
  console.log(hashedToken);
  const user = await User.findOne({
    userVerifyToken: hashedToken,
  });
  console.log(user);
  // 2) If token true, verify this user
  if (!user) {
    return next(new AppError("Mã xác nhận không hợp lệ hoặc đã hết hạn", 400));
  }
  user.active = "active";
  user.userVerifyToken = undefined;
  await user.save({ validateBeforeSave: false });

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.signup = catchAsync(async (req, res, next) => {
  // SECURITY: Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.email)) {
    return next(new AppError("Email không hợp lệ", 400));
  }
  
  // SECURITY: Validate password strength
  if (!validatePasswordStrength(req.body.password)) {
    return next(new AppError(
      "Mật khẩu phải chứa ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt", 
      400
    ));
  }
  
  const userExist = await User.find({ email: req.body.email });
  console.log(JSON.stringify(userExist));
  if (JSON.stringify(userExist) != "[]") {
    return next(new AppError("Email này đã được đăng ký.", 500));
  }
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  sendVerifyToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log("🔐 Login attempt:", { email, timestamp: new Date().toISOString() });

  // SECURITY: Input validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !password) {
    return next(new AppError("Vui lòng cung cấp email và mật khẩu!", 400));
  }
  if (!emailRegex.test(email)) {
    return next(new AppError("Email không hợp lệ", 400));
  }
  
  // 2) Check if user exists && password is correct
  console.log("🔍 Searching for user:", email);
  const user = await User.findOne({ email }).select("+password +loginAttempts +lockUntil");
  console.log("✅ User found:", user ? "YES" : "NO");

  // SECURITY: Check if account is locked
  if (user && user.isAccountLocked()) {
    console.warn(`⚠️ Login attempt on locked account: ${email}`);
    const lockUntilTime = new Date(user.lockUntil);
    const lockUntilMinutes = Math.ceil((lockUntilTime - Date.now()) / (60 * 1000));
    
    const error = new AppError(
      `Tài khoản bị khóa do đăng nhập sai 5 lần. Vui lòng thử lại sau ${lockUntilMinutes} phút.`,
      401
    );
    error.code = "ACCOUNT_LOCKED";
    error.lockUntilMinutes = lockUntilMinutes;
    error.lockUntil = lockUntilTime;
    return next(error);
  }

  if (
    !user ||
    !(await user.correctPassword(password.toString(), user.password))
  ) {
    // SECURITY: Increment failed login attempts
    if (user) {
      await user.incLoginAttempts();
      const remainingAttempts = 5 - user.loginAttempts;
      
      // If account just got locked (5th attempt)
      if (user.isAccountLocked()) {
        console.warn(`⚠️ Account locked after 5 failed attempts: ${email}`);
        const lockUntilTime = new Date(user.lockUntil);
        const lockUntilMinutes = Math.ceil((lockUntilTime - Date.now()) / (60 * 1000));
        
        const error = new AppError(
          `Tài khoản bị khóa do đăng nhập sai 5 lần. Vui lòng thử lại sau ${lockUntilMinutes} phút.`,
          401
        );
        error.code = "ACCOUNT_LOCKED";
        error.lockUntilMinutes = lockUntilMinutes;
        error.lockUntil = lockUntilTime;
        return next(error);
      } else if (remainingAttempts > 0) {
        console.warn(`⚠️ Login failed for ${email}. Remaining attempts: ${remainingAttempts}`);
        const error = new AppError(
          `Mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
          401
        );
        error.code = "INVALID_PASSWORD";
        error.remainingAttempts = remainingAttempts;
        return next(error);
      }
    }
    return next(new AppError("Email hoặc mật khẩu không chính xác", 401));
  }
  
  // 2.5) Check if user is banned
  if (user.active == "ban") {
    return next(new AppError("Tài khoản của bạn đã bị ban. Vui lòng liên hệ quản trị viên.", 403));
  }

  // SECURITY: Reset login attempts on successful login
  await user.resetLoginAttempts();
  
  // 3) Check if user not verify, send code to gmail
  if (user.active == "verify") {
    sendVerifyToken(user, 201, res);
  }

  // 4) If everything ok, send token to client
  else {
    createSendToken(user, 200, res);
  }
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    // Skip if token is literally "undefined" string (from FE)
    if (token === "undefined") {
      token = null;
    }
  }
  
  // Try cookie if no valid token in header
  if (!token && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // If no token found
  if (!token) {
    return next(
      new AppError(
        "Bạn chưa đăng nhập hoặc đăng ký. Vui lòng thực hiện!!!",
        401
      )
    );
  }

  // 2) Verification token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Token không hợp lệ. Vui lòng đăng nhập lại.", 401));
    }
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token hết hạn. Vui lòng đăng nhập lại.", 401));
    }
    throw err;
  }

  // 2.5) SECURITY: Check if token is blacklisted (revoked)
  const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(token);
  if (isBlacklisted) {
    return next(
      new AppError("Token đã bị thu hồi. Vui lòng đăng nhập lại.", 401)
    );
  }

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError("Token người dùng không còn tồn tại.", 401));
  }
  
  console.log(`[PROTECT] ✅ User loaded:`, {
    id: currentUser._id,
    email: currentUser.email,
    role: currentUser.role,
    roleType: typeof currentUser.role
  });

  // 3.5) Check if user is banned
  if (currentUser.active == "ban") {
    return next(
      new AppError("Tài khoản của bạn đã bị ban. Vui lòng liên hệ quản trị viên.", 403)
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "Tài khoản gần đây đã thay đổi mật khẩu! Xin vui lòng đăng nhập lại.",
        401
      )
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if token is blacklisted (revoked)
      const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(req.cookies.jwt);
      if (isBlacklisted) {
        // Token was revoked via logout
        return next();
      }

      // 3) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      
      // 4) Check if user is banned - clear cookie
      if (currentUser.active == "ban") {
        res.clearCookie("jwt", { path: "/" });
        return next();
      }
      
      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'employee',[user]]. role='user'
    const userRole = req.user?.role;
    const rolesString = roles.join(', ');
    
    console.log(`[RESTRICT_TO] User role: '${userRole}' (type: ${typeof userRole}), Required: [${rolesString}]`);
    console.log(`[RESTRICT_TO] User object keys:`, Object.keys(req.user || {}));
    console.log(`[RESTRICT_TO] Role check: ${userRole} in [${rolesString}]? ${roles.includes(userRole)}`);
    
    if (req.user == undefined || !roles.includes(userRole)) {
      console.log(`[AUTH] ❌ Access Denied - User role: ${userRole || 'undefined'}, Required: ${rolesString}`);
      return next(new AppError("Bạn không có quyền thực hiện", 403));
    }
    
    console.log(`[AUTH] ✅ Access Granted - User role: ${userRole}`);
    next();
  };
};

// Middleware kiểm tra permission
exports.checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Bạn cần đăng nhập để thực hiện hành động này", 401));
    }
    
    const { hasPermission } = require("./../utils/permissions");
    const userRole = req.user.role;
    
    // Super admin có tất cả quyền
    if (userRole === "super_admin") {
      return next();
    }
    
    if (!hasPermission(userRole, resource, action)) {
      return next(new AppError("Bạn không có quyền thực hiện hành động này", 403));
    }
    
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new AppError(
        "Tài khoản này không tồn tại. Vui lòng đăng ký để sử dụng",
        404
      )
    );
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/forgot-password`;

  const message = `Bạn quên mật khẩu? Mã xác nhận của bạn: ${resetToken}.\nĐổi mật khẩu mới tại : ${resetURL}.\nNếu không phải bạn, vui lòng bỏ qua email này!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "Đã có lỗi xảy ra trong quá trình gửi mail. Vui lòng thực hiện lại sau!"
      ),
      500
    );
  }
});
exports.verifyResetPass = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Token không hợp lệ hoặc đã hết hạn", 400));
  }
  res.status(200).json({
    status: "success",
    hashedToken,
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const user = await User.findOne({
    passwordResetToken: req.params.token,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("oken không hợp lệ hoặc đã hết hạn", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Mật khẩu hiện tại chưa chính xác.", 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

// Logout endpoint - bỏ qua token expiry check
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Decode token KHÔNG verify expiry
      const decoded = jwt.decode(token); // Không dùng verify!
      
      if (decoded) {
        // Thêm token vào blacklist ngay cả khi expired
        await TokenBlacklist.create({
          token: token,
          expiresAt: new Date(decoded.exp * 1000)
        });
      }
    }
    
    // Clear cookies with EXACT same settings as when they were set
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    };
    
    // Clear refreshToken cookie
    res.clearCookie('refreshToken', cookieOptions);
    
    // Clear jwt cookie (access token)
    res.clearCookie('jwt', cookieOptions);
    
    // Clear any other auth cookies with same path
    res.clearCookie('token', cookieOptions);
    
    console.log("✅ Cookies cleared:", { 
      secure: cookieOptions.secure, 
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path 
    });
    
    res.json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even on error, attempt to clear cookies
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    };
    
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('jwt', cookieOptions);
    res.clearCookie('token', cookieOptions);
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out'
    });
  }
};

exports.googleLogin = catchAsync(async (req, res) => {
  const email = req.body.email;
  // 1) Check if user exists
  const data = await User.findOne({ email });
  if (!data) {
    return res.status(400).json({ message: "Tài khoản này không tồn tại" });
  }
  
  // 2) Check if user is banned
  if (data.active == "ban") {
    return res.status(403).json({ message: "Tài khoản của bạn đã bị ban. Vui lòng liên hệ quản trị viên." });
  }
  
  // 3) Check if user has admin role
  const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
  if (adminRoles.includes(data.role)) {
    createSendToken(data, 200, res);
  }
  // 4) If user does not have admin role
  else {
    res.status(400).json({ message: "Tài khoản này không được phép truy cập" });
  }
});

// SECURITY: Refresh Token Endpoint
exports.refreshAccessToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return next(new AppError("Refresh token not found. Please login again.", 401));
  }
  
  try {
    // Verify refresh token
    const decoded = await promisify(jwt.verify)(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    
    // Check if user is banned
    if (user.active === "ban") {
      return next(new AppError("Account has been banned", 403));
    }
    
    // Generate new access token
    const newAccessToken = signAccessToken(user._id);
    
    // Update jwt cookie with new access token
    const cookieOptions = {
      expires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };
    res.cookie("jwt", newAccessToken, cookieOptions);
    
    res.status(200).json({
      status: "success",
      accessToken: newAccessToken,
      message: "Access token refreshed successfully",
    });
  } catch (err) {
    return next(new AppError("Refresh token invalid or expired. Please login again.", 401));
  }
});

exports.userLoginWith = catchAsync(async (req, res, next) => {
  const { email, displayName, emailVerified } = req.body.user;
  // 1) Check if user exists
  const data = await User.findOne({ email });
  // 2) Check if user does not exist, create one and send token
  if (!data) {
    const password = email + process.env.JWT_SECRET;
    const inform = {
      email,
      password,
      passwordConfirm: password,
      name: displayName,
      active: "active",
    };
    const newUser = await User.create(inform);
    createSendToken(newUser, 200, res);
  }
  // 3) If user exist
  else {
    if (data.active == "ban")
      return next(new AppError("Tài khoản của bạn đã bị ban.", 401));
    if (data.active == "verify") {
      data.active = "active";
      await data.save({ validateBeforeSave: false });
    }
    createSendToken(data, 200, res);
  }
});
