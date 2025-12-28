const mongoose = require("mongoose");

// SECURITY: JWT Token Blacklist Model
// For logging out: when user logs out, token is added to blacklist
// When verifying token, check if it's in blacklist
const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    index: true,
  },
  
  // Token expiration time
  expiresAt: {
    type: Date,
    required: true,
    index: true, // For efficient cleanup
  },
  
  // Reason for blacklisting
  reason: {
    type: String,
    enum: ["USER_LOGOUT", "FORCE_LOGOUT", "PASSWORD_CHANGED", "ADMIN_REVOKE", "SECURITY_INCIDENT"],
    default: "USER_LOGOUT",
  },
  
  // When blacklisted
  blacklistedAt: {
    type: Date,
    default: Date.now,
  },
  
  ipAddress: String, // IP that initiated logout
  userAgent: String,
});

// TTL index to auto-delete expired tokens from blacklist
// MongoDB will delete documents 0 seconds after expiresAt
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to blacklist token
tokenBlacklistSchema.statics.blacklistToken = async function (token, userId, expiresAt, reason = "USER_LOGOUT", ipAddress = null, userAgent = null) {
  try {
    const blacklistedToken = await this.create({
      token,
      userId,
      expiresAt: new Date(expiresAt * 1000), // Convert from seconds to milliseconds
      reason,
      ipAddress,
      userAgent,
    });
    console.log(`✅ Token blacklisted for user ${userId}`);
    return blacklistedToken;
  } catch (error) {
    console.error("❌ Error blacklisting token:", error.message);
    throw error;
  }
};

// Static method to check if token is blacklisted
tokenBlacklistSchema.statics.isTokenBlacklisted = async function (token) {
  try {
    const blacklistedToken = await this.findOne({ token });
    return !!blacklistedToken;
  } catch (error) {
    console.error("❌ Error checking token blacklist:", error.message);
    return true; // Fail safe: if check fails, treat as blacklisted
  }
};

// Static method to revoke all tokens for a user (force logout)
tokenBlacklistSchema.statics.revokeUserTokens = async function (userId, reason = "FORCE_LOGOUT") {
  try {
    // In production, you might want to store this differently
    // This is a simplified version that would work with a cache like Redis
    console.log(`⚠️ Force logout initiated for user ${userId} (reason: ${reason})`);
    // Implementation depends on your cache strategy
    return true;
  } catch (error) {
    console.error("❌ Error revoking user tokens:", error.message);
    throw error;
  }
};

// Static method to get blacklist history for a user
tokenBlacklistSchema.statics.getUserBlacklistHistory = async function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ blacklistedAt: -1 })
    .limit(limit)
    .lean();
};

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

module.exports = TokenBlacklist;
