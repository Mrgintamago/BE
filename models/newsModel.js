const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: false, // Không bắt buộc, sẽ tự động tạo từ content nếu không có
      trim: true,
      maxlength: [200, "Tiêu đề tối đa 200 ký tự"],
    },
    content: {
      type: String,
      required: [true, "Tin tức phải có nội dung"],
    },
    images: {
      type: [String],
      default: [],
    },
    author: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Tin tức phải có tác giả"],
      validate: {
        validator: function(v) {
          return v != null && mongoose.Types.ObjectId.isValid(v);
        },
        message: "Tác giả phải là một ObjectId hợp lệ"
      }
    },
    authorName: {
      type: String,
      trim: true,
      default: null, // Will be set by setAuthor middleware if not provided
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    views: {
      type: Number,
      default: 0,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // Cho phép null/undefined và chỉ unique khi có giá trị
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Tạo slug từ title trước khi lưu
newsSchema.pre("save", function (next) {
  // Tự động tạo title từ content nếu không có title
  if (!this.title && this.content) {
    // Lấy text thuần từ HTML content
    const textContent = this.content.replace(/<[^>]*>/g, "").trim();
    this.title = textContent.substring(0, 50) + (textContent.length > 50 ? "..." : "");
  }
  
  // Tạo slug từ title
  if ((this.isModified("title") || this.isNew) && !this.slug) {
    const titleForSlug = this.title || (this._id ? this._id.toString() : Date.now().toString());
    let baseSlug = titleForSlug
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    // Thêm timestamp để tránh duplicate
    if (!baseSlug) {
      baseSlug = "news-" + Date.now();
    } else {
      baseSlug = baseSlug + "-" + Date.now();
    }
    
    this.slug = baseSlug;
  }
  
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  next();
});

// Index để tìm kiếm
newsSchema.index({ "$**": "text" });
newsSchema.index({ slug: 1 });
newsSchema.index({ status: 1, createdAt: -1 });

// Populate author khi query
newsSchema.pre(/^find/, function (next) {
  this.populate({
    path: "author",
    select: "name email",
  });
  next();
});

const News = mongoose.model("News", newsSchema);

module.exports = News;

