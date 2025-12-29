const AuditLog = require("../models/auditLogModel");
const logger = require("../utils/logger");

/**
 * SECURITY: Audit Logging Middleware
 * Logs all important actions to the database for compliance and security monitoring
 */

// Main audit logging middleware
const auditLog = async (req, res, next) => {
  // Skip audit logging for certain endpoints (health check, etc)
  const skipPaths = ["/health", "/ping", ""];
  if (skipPaths.includes(req.path)) return next();

  // Store original res.json and res.status for intercepting
  const originalJson = res.json;
  const originalStatus = res.status;

  let statusCode = 200;
  let responseData = null;

  // Intercept res.status
  res.status = function (code) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  // Intercept res.json to capture response
  res.json = function (data) {
    responseData = data;
    return originalJson.call(this, data);
  };

  // Listen for response finish
  res.on("finish", async () => {
    try {
      const logData = {
        userId: req.user?._id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || "guest",
        
        method: req.method,
        endpoint: req.path,
        statusCode: statusCode,
        
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("user-agent") || "Unknown",
        
        status: statusCode >= 400 ? "FAILURE" : "SUCCESS",
        errorMessage: responseData?.message || null,
      };

      // Determine action and resource type based on endpoint and method
      if (req.path.includes("/auth/login")) {
        logData.action = statusCode === 200 ? "LOGIN_SUCCESS" : "LOGIN_FAILED";
        logData.resourceType = "User";
        logData.resourceId = req.user?._id;
      } else if (req.path.includes("/auth/logout")) {
        logData.action = "LOGOUT";
        logData.resourceType = "User";
        logData.resourceId = req.user?._id;
      } else if (req.path.includes("/auth/updatePassword")) {
        logData.action = "PASSWORD_CHANGED";
        logData.resourceType = "User";
        logData.resourceId = req.user?._id;
      } else if (req.path.includes("/orders") && req.method === "POST") {
        logData.action = "ORDER_CREATED";
        logData.resourceType = "Order";
        logData.resourceName = responseData?.data?._id;
      } else if (req.path.includes("/orders") && req.method === "PATCH") {
        logData.action = "ORDER_UPDATED";
        logData.resourceType = "Order";
      } else if (req.path.includes("/payment/payos")) {
        logData.action = "PAYMENT_INITIATED";
        logData.resourceType = "Payment";
      } else if (req.path.includes("/products") && req.method === "POST") {
        logData.action = "PRODUCT_CREATED";
        logData.resourceType = "Product";
      } else if (req.path.includes("/products") && req.method === "DELETE") {
        logData.action = "PRODUCT_DELETED";
        logData.resourceType = "Product";
      } else if (req.user?.role && ["admin", "super_admin"].includes(req.user.role)) {
        logData.action = "ADMIN_ACTION";
        logData.resourceType = "Admin";
      } else {
        logData.action = "OTHER";
        logData.resourceType = "System";
      }

      // Log only important actions or errors
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || statusCode >= 400) {
        await AuditLog.log(logData);
      }
    } catch (error) {
      logger.error("❌ Audit logging error:", error.message);
      // Don't throw - audit logging failure shouldn't affect main app
    }
  });

  next();
};

/**
 * Helper to manually log specific actions
 * Usage: await logAction(req, 'ACTION_NAME', 'ResourceType', resourceId, details)
 */
const logAction = async (req, action, resourceType, resourceId = null, details = null, status = "SUCCESS") => {
  try {
    const logData = {
      userId: req.user?._id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || "guest",
      
      action,
      resourceType,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      
      method: req.method,
      endpoint: req.path,
      
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent") || "Unknown",
      
      status,
    };

    await AuditLog.log(logData);
    logger.log(`✅ Audit logged: ${action}`);
  } catch (error) {
    logger.error("❌ Failed to log action:", error.message);
  }
};

module.exports = {
  auditLog,
  logAction,
};
