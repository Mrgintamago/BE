const mongoose = require("mongoose");

// SECURITY: Audit Logging Model
const auditLogSchema = new mongoose.Schema({
  // Actor (who did the action)
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    default: null, // null for guest/system actions
  },
  userEmail: String, // Stored for reference even if user deleted
  userRole: String,
  
  // Action details
  action: {
    type: String,
    enum: [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGIN_ATTEMPT_LIMIT_EXCEEDED",
      "LOGOUT",
      "PASSWORD_CHANGED",
      "PASSWORD_RESET",
      "USER_CREATED",
      "USER_UPDATED",
      "USER_DELETED",
      "ORDER_CREATED",
      "ORDER_UPDATED",
      "ORDER_CANCELLED",
      "PAYMENT_INITIATED",
      "PAYMENT_COMPLETED",
      "PAYMENT_FAILED",
      "PRODUCT_CREATED",
      "PRODUCT_UPDATED",
      "PRODUCT_DELETED",
      "DATA_EXPORT",
      "SENSITIVE_DATA_ACCESSED",
      "UNAUTHORIZED_ACCESS_ATTEMPT",
      "ADMIN_ACTION",
      "SYSTEM_ERROR",
      "OTHER"
    ],
    required: true,
  },
  
  // Resource affected
  resourceType: {
    type: String,
    enum: ["User", "Order", "Product", "Payment", "Admin", "System"],
    required: true,
  },
  resourceId: mongoose.Schema.ObjectId,
  resourceName: String,
  
  // Request details
  method: {
    type: String,
    enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
  endpoint: String,
  ipAddress: String,
  userAgent: String,
  
  // Result
  status: {
    type: String,
    enum: ["SUCCESS", "FAILURE", "WARNING"],
    default: "SUCCESS",
  },
  statusCode: Number,
  errorMessage: String,
  
  // Additional context
  details: mongoose.Schema.Types.Mixed, // Store additional data (before/after values)
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true, // For efficient date range queries
  },
  
  // Data retention policy: keep for 90 days then archive
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    index: true,
  },
});

// TTL index to auto-delete old logs after 90 days
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for common queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

// Static method to create audit log
auditLogSchema.statics.log = async function (logData) {
  try {
    const log = await this.create(logData);
    return log;
  } catch (error) {
    console.error("❌ Failed to create audit log:", error.message);
    // Don't throw - audit logging failure shouldn't break the app
  }
};

// Static method to get audit trail for a resource
auditLogSchema.statics.getAuditTrail = async function (resourceType, resourceId, limit = 50) {
  return this.find({ resourceType, resourceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get user's activity
auditLogSchema.statics.getUserActivity = async function (userId, limit = 100) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Mask sensitive data in logs
auditLogSchema.methods.maskSensitiveData = function () {
  if (this.details) {
    const sensitiveFields = ["password", "passwordConfirm", "creditCard", "cardNumber"];
    sensitiveFields.forEach(field => {
      if (this.details[field]) {
        this.details[field] = "***REDACTED***";
      }
    });
  }
  return this;
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
