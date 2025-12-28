const express = require("express");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const engine = require("ejs-mate");

const AppError = require("./utils/appError");
// const globalErrorHandler = require("./controllers/errorController");
const { auditLog } = require("./middleware/auditLogMiddleware");
const productRouter = require("./routes/productRoutes");
const userRouter = require("./routes/userRoutes");
const categoryRouter = require("./routes/categoryRoutes");
const brandRouter = require("./routes/brandRoutes");
const reviewRouter = require("./routes/reviewRoutes");
const orderRouter = require("./routes/orderRoutes");
const commentRouter = require("./routes/commentRoutes");
const viewRouter = require("./routes/viewRoutes");
const transactionRouter = require("./routes/transactionRoutes");
const locationRouter = require("./routes/locationRoutes");
const newsRouter = require("./routes/newsRoutes");
const partnerRegistrationRouter = require("./routes/partnerRegistrationRoutes");
const paymentRouter = require("./routes/paymentRoutes");

const app = express();
app.engine("ejs", engine);
app.set("view engine", "ejs");

// PRODUCTION: Trust proxy headers from Vercel/reverse proxies
// Required for rate limiting and accurate IP detection
app.set("trust proxy", 1);

// Set local variables for views
app.locals.tinymceApiKey = process.env.TINYMCE_API_KEY || "no-api-key";

// SECURITY: CORS Hardening - strict origin whitelist
const allowedOrigins = [
  // Development
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  
  // Production - từ environment variable
  process.env.FRONTEND_URL,
  
  // Fallback & Frontend URLs
  "https://tqn-figure-fe.vercel.app",
  "https://fe-mu-mauve.vercel.app",
  "https://www.tqnfirgureshop.store"
].filter(Boolean); // Loại bỏ undefined values

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-CSRF-Token"],
    maxAge: 86400
  })
);
// Serving static files
// app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/bootstrap",
  express.static(__dirname + "/node_modules/bootstrap/dist/")
);
app.use("/text", express.static(__dirname + "/node_modules/tinymce/"));
// 1) GLOBAL MIDDLEWARE
// Set security HTTP headers with relaxed CSP for admin panel resources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-hashes'",
        "https://code.jquery.com",
        "https://cdn.datatables.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://cdn.tiny.cloud",
        "https://cdn.socket.io",
        "http://localhost:3000"
      ],
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.datatables.net",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://cdn.tiny.cloud",
        "https://npmcdn.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://cdn-icons-png.flaticon.com",
        "https://png.pngtree.com",
        "https://res.cloudinary.com",
        "https://cdn.jsdelivr.net",
        "https:"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      connectSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.datatables.net",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://cdn.tiny.cloud",
        "https://cdn.socket.io",
        "https://tqn.onrender.com",
        "https://png.pngtree.com",
        "http://localhost:3000"
      ],
      frameSrc: [
        "'self'",
        "https://cdn.tiny.cloud"
      ],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin image loading
}));

// CORS đã được config ở trên, không cần set header thêm nữa
app.use(cookieParser());

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

// SECURITY: Audit Logging - logs all important actions
app.use(auditLog);

// SECURITY: Body parser with size limits (10MB for file uploads)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// SECURITY: Prevent payload denial of service - limit request size
app.use((req, res, next) => {
  if (req.headers["content-length"] > 10485760) { // 10MB
    return res.status(413).json({
      status: "error",
      message: "Request payload too large (max 10MB)"
    });
  }
  next();
});

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ["ratingsQuantity", "ratingsAverage", "price"],
  })
);

// SECURITY: CSRF Protection - Only for state-changing requests (POST, PUT, DELETE, PATCH)
// Use cookie-based CSRF tokens for API (no session required)
const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  // CSRF protection disabled for API routes (frontend is SPA, uses different origin handling)
  // CORS + credentials already provide CSRF protection for SPA
  
  // Skip CSRF for all /api/* routes (SPA frontend handles CORS)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // CSRF only for form-based endpoints (EJS views)
  csrfProtection(req, res, next);
});

// SECURITY: Endpoint to get CSRF token for legacy form-based clients
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Serving static files
app.use(express.static(`${__dirname}/views`));
app.use(express.static(`${__dirname}/public`));

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);
  next();
});

// 3) ROUTES
app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/brands", brandRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/payments", transactionRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/locations", locationRouter);
app.use("/api/v1/news", newsRouter);
app.use("/api/v1/partner-registrations", partnerRegistrationRouter);
app.use("/", viewRouter);

app.all("*", (req, res, next) => {
  // next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  res.status(200).render("404");
});

app.use((err, req, res, next) => {
  // console.log(err.stack);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
});

module.exports = app;
