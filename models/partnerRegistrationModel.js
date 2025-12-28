const mongoose = require("mongoose");

const partnerRegistrationSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Tên công ty không thể để trống"],
      trim: true,
    },
    contactPerson: {
      type: String,
      required: [true, "Người liên hệ không thể để trống"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email không thể để trống"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Số điện thoại không thể để trống"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Địa chỉ không thể để trống"],
      trim: true,
    },
    businessType: {
      type: String,
      required: [true, "Loại hình kinh doanh không thể để trống"],
      enum: ["retail", "wholesale", "online", "other"],
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "contacted", "rejected"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for search
partnerRegistrationSchema.index({ "$**": "text" });
partnerRegistrationSchema.index({ status: 1, createdAt: -1 });

// Update updatedAt before save
partnerRegistrationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const PartnerRegistration = mongoose.model("PartnerRegistration", partnerRegistrationSchema);

module.exports = PartnerRegistration;

