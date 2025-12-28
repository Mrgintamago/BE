const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const APIFeatures = require("./../utils/apiFeatures");
const Product = require("./../models/productModel");
const Review = require("./../models/reviewModel");
const Order = require("./../models/orderModel");
const Import = require("./../models/importModel");
const User = require("./../models/userModel");
const Comment = require("./../models/commentModel");
const News = require("./../models/newsModel");

// async function recursiveChildren(obj, arr) {
//   const data = await Comment.findById(obj);
//   for (let i = 0; i < data.children.length; i++) {
//     if (arr.includes(data.children[i])) {
//       data.splice(i, 1);
//       i--;
//     }
//   }
//   if (data.children == null) {
//     arr.push(obj);
//     return;
//   } else recursiveChildren(data.children[0].id, arr);
// }

function handleQuery(req, value) {
  const obj = {};
  if (req.query[value + "_lt"] != undefined) obj.lt = req.query[value + "_lt"];
  if (req.query[value + "_lte"] != undefined)
    obj.lte = req.query[value + "_lte"];
  if (req.query[value + "_gt"] != undefined) obj.gt = req.query[value + "_gt"];
  if (req.query[value + "_gte"] != undefined)
    obj.gte = req.query[value + "_gte"];
  if (JSON.stringify(obj) !== "{}") req.query[value] = obj;
}

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (Model == Import) {
      const invoice = await Model.findById(req.params.id);
      // Sử dụng for...of thay vì forEach với async để đảm bảo chờ đợi đúng cách
      for (const value of invoice.invoice) {
        await Product.findByIdAndUpdate(value.product, {
          $inc: { inventory: -value.quantity },
        });
      }
    }
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError("Không tìm thấy dữ liệu với ID này", 404));
    }
    if (Model == Comment) {
      // let arr = [];
      // for (const value of doc.children) {
      //   await recursiveChildren(value.id, arr);
      // }
      // await doc.children.forEach(async (value) => {
      //   await recursiveChildren(value.id, arr);
      // });
      await Model.deleteMany({
        _id: { $in: doc.children },
      });
      // await doc.children.forEach(async (child) => {
      //   // await Model.findByIdAndDelete(child);
      //   await Model.remove({
      //     _id: { $in: child },
      //   });
      // });
      if (doc.parent != null) {
        const parent = await Model.findById(doc.parent);
        const newChildren = await parent.children.filter(
          (child) => child.id != doc.id
        );
        parent.children = newChildren;
        await parent.save({ validateBeforeSave: false });
      }
    }
    if (Model == Review) {
      Model.calcAverageRatings(doc.product);
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (Model == Product) {
      console.log("[UPDATE PRODUCT] 📝 Request body:", Object.keys(req.body));
      console.log("[UPDATE PRODUCT] Price:", req.body.price, "Promotion:", req.body.promotion);
      
      req.body.updatedBy = req.user.id;
      req.body.updatedAt = Date.now() - 1000;
      
      // Handle description safely - only if provided
      if (req.body.description) {
        console.log("[UPDATE PRODUCT] ✅ Processing description");
        req.body.description = req.body.description
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");
      }
      
      console.log("[UPDATE PRODUCT] 🔄 Updating document...");
      const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: false,
      });
      if (!doc) {
        return next(new AppError("Không tìm thấy dữ liệu với ID này", 404));
      }

      console.log("[UPDATE PRODUCT] ✅ Updated successfully");
      res.status(200).json({
        status: "success",
        data: {
          data: doc,
        },
      });
    }
    if (Model == Review || Model == Comment) {
      req.body.updateAt = Date.now() - 1000;
    }
    if (Model == Import) {
      const invoice = await Model.findById(req.params.id);
      // Sử dụng for...of thay vì forEach với async để đảm bảo chờ đợi đúng cách
      for (const value of invoice.invoice) {
        await Product.findByIdAndUpdate(value.product, {
          $inc: { inventory: -value.quantity },
        });
      }
      const product = req.body.invoice;
      for (const value of product) {
        await Product.findByIdAndUpdate(value.product, {
          $inc: { inventory: value.quantity },
        });
      }
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError("Không tìm thấy dữ liệu với ID này", 404));
    }
    if (Model == Review) {
      Model.calcAverageRatings(doc.product);
    }
    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (Model == Product) {
      req.body.createdBy = req.user.id;
    }
    if (Model == Order) {
      const cart = req.body.cart;
      for (const value of cart) {
        const name =
          value.product.title.length > 39
            ? value.product.title.slice(0, 40)
            : value.product.title;
        const invent = await Product.findById(value.id);
        if (value.quantity > invent.inventory) {
          return next(
            new AppError(`Số lượng hàng ${name} trong kho không đủ`, 500)
          );
        }
      }

      const doc = await Model.create(req.body);
      for (const value of cart) {
        await Product.findByIdAndUpdate(value.id, {
          $inc: { inventory: -value.quantity, sold: value.quantity },
        });
      }

      return res.status(201).json({
        status: "success",
        data: {
          id: doc.id,
          totalPrice: doc.totalPrice,
        },
      });
    }

    if (Model == Import) {
      const invoice = req.body.invoice;
      for (const value of invoice) {
        await Product.findByIdAndUpdate(value.product, {
          $inc: { inventory: value.quantity },
        });
      }
    }

    try {
      const doc = await Model.create(req.body);
      if (Model === Comment) {
        const data = await Comment.findById(req.body.parent);
        if (data) {
          data.children.push(doc.id);
          await data.save({ validateBeforeSave: false });
        }
      }
      res.status(201).json({
        status: "success",
        data: {
          data: doc,
        },
      });
    } catch (error) {
      console.error("Create error:", error);
      // Xử lý lỗi validation
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message).join(', ');
        return next(new AppError(`Validation error: ${messages}`, 400));
      }
      // Xử lý lỗi duplicate key (slug)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return next(new AppError(`${field} đã tồn tại`, 400));
      }
      return next(error);
    }
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    let doc = await query;

    if (!doc) {
      return next(new AppError("Không tìm thấy dữ liệu với ID này", 404));
    }

    // Tăng lượt xem cho sản phẩm
    if (Model === Product) {
      const updated = await Model.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
      );
      if (updated) doc = updated;
    }

    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    handleQuery(req, "price");
    handleQuery(req, "promotion");
    // To allow for nested GET reviews on tour (hack)
    let filter = {};
    if (req.params.productId) filter = { product: req.params.productId };
    if (Model == Comment) filter.parent = null;
    // For News model, only show published articles for public routes
    if (Model === News && req.query.status) {
      filter.status = req.query.status;
    } else if (Model === News && !req.user) {
      // Nếu không đăng nhập, chỉ hiển thị bài đã published
      filter.status = "published";
    }
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    // const doc = await features.query.explain();
    const doc = await features.query;
    let totalPage = 1;

    if (Model == Review && req.params.productId) {
      const more = await Product.findById(req.params.productId).populate({
        path: "reviews",
      });
      const totalFilter = more.reviews.length;
      if (req.query.page != undefined) {
        totalPage = Math.ceil(totalFilter / Number(req.query.limit));
      }
      if (req.query.page > totalPage)
        return res.status(200).json({
          status: "success",
          data: {
            data: doc,
            results: doc.length,
            ratingsQuantity: more.ratingsQuantity,
            ratingsAverage: more.ratingsAverage,
            eachRating: more.eachRating,
            totalPage: 1,
          },
        });
      return res.status(200).json({
        status: "success",
        data: {
          data: doc,
          results: doc.length,
          ratingsQuantity: more.ratingsQuantity,
          ratingsAverage: more.ratingsAverage,
          eachRating: more.eachRating,
          totalPage,
        },
      });
    }

    if (req.query.page != undefined) {
      const filterModel = new APIFeatures(Model.find(filter), req.query)
        .filter()
        .sort()
        .limitFields();
      const filterData = await filterModel.query;

      totalPage = Math.ceil(filterData.length / Number(req.query.limit));
      if (req.query.page > totalPage)
        return res.status(200).json({
          status: "success",
          data: {
            data: doc,
            results: doc.length,
            totalPage: 1,
          },
        });
    }
    // SEND RESPONSE
    res.status(200).json({
      status: "success",
      results: doc.length,
      data: {
        data: doc,
        totalPage,
        currentPage: req.query.page,
      },
    });
  });
exports.getTable = (Model) =>
  catchAsync(async (req, res, next) => {
    try {
      let filter = {};
      
      // Xử lý search - ưu tiên searchValue từ custom filter, nếu không có thì dùng search mặc định của DataTable
      let searchStr = req.query.searchValue || (req.query.search && req.query.search["value"] ? req.query.search["value"] : "");
      if (searchStr) {
        // Sử dụng regex để tìm kiếm partial match, không phân biệt hoa thường
        const escapedKeyword = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Xác định field cần search dựa trên model
        if (Model == Product) {
          filter["title"] = { $regex: escapedKeyword, $options: 'i' };
        } else if (Model == User) {
          filter["$or"] = [
            { name: { $regex: escapedKeyword, $options: 'i' } },
            { email: { $regex: escapedKeyword, $options: 'i' } }
          ];
        } else if (Model == Order) {
          // Search theo receiver, phone, email
          const searchRegex = { $regex: escapedKeyword, $options: 'i' };
          filter["$or"] = [
            { receiver: searchRegex },
            { phone: searchRegex },
            { email: searchRegex }
          ];
          // Thử search theo ObjectId nếu searchStr giống ObjectId format (24 ký tự hex)
          if (searchStr.length === 24 && /^[0-9a-fA-F]{24}$/i.test(searchStr)) {
            try {
              const mongoose = require("mongoose");
              filter["$or"].push({ _id: mongoose.Types.ObjectId(searchStr) });
            } catch (e) {
              // Nếu không phải ObjectId hợp lệ, bỏ qua
            }
          }
        } else if (Model == Review) {
          filter["review"] = { $regex: escapedKeyword, $options: 'i' };
        } else if (Model == News) {
          filter["$or"] = [
            { title: { $regex: escapedKeyword, $options: 'i' } },
            { content: { $regex: escapedKeyword, $options: 'i' } }
          ];
        } else if (Model == Comment) {
          filter["comment"] = { $regex: escapedKeyword, $options: 'i' };
        } else if (Model.modelName === "PartnerRegistration") {
          filter["$or"] = [
            { companyName: { $regex: escapedKeyword, $options: 'i' } },
            { contactPerson: { $regex: escapedKeyword, $options: 'i' } },
            { email: { $regex: escapedKeyword, $options: 'i' } }
          ];
        } else if (Model.modelName === "Brand" || Model.modelName === "Category") {
          filter["name"] = { $regex: escapedKeyword, $options: 'i' };
        } else if (Model.modelName === "Import") {
          // Search theo import ID - thử ObjectId nếu searchStr giống ObjectId format
          if (searchStr.length === 24 && /^[0-9a-fA-F]{24}$/i.test(searchStr)) {
            try {
              const mongoose = require("mongoose");
              filter["_id"] = mongoose.Types.ObjectId(searchStr);
            } catch (e) {
              // Nếu không phải ObjectId hợp lệ, không search
            }
          }
        } else {
          // Default: search theo title nếu có, nếu không thì search theo name
          if (Model.schema.paths.title) {
            filter["title"] = { $regex: escapedKeyword, $options: 'i' };
          } else if (Model.schema.paths.name) {
            filter["name"] = { $regex: escapedKeyword, $options: 'i' };
          }
        }
      }
      
      // Filter theo category
      if (req.query.category) {
        filter["category"] = req.query.category;
      }
      
      // Filter theo brand
      if (req.query.brand) {
        filter["brand"] = req.query.brand;
      }
      
      // Filter theo productType
      if (req.query.productType) {
        filter["productType"] = req.query.productType;
      }
      
      // Filter theo inventory
      if (req.query.inventory === "out-of-stock") {
        filter["inventory"] = { $lte: 0 };
      } else if (req.query.inventory === "in-stock") {
        filter["inventory"] = { $gt: 0 };
      } else if (req.query.inventory === "low-stock") {
        filter["inventory"] = { $gt: 0, $lte: 10 };
      }
      
      // Filter theo giá
      if (req.query.priceMin || req.query.priceMax) {
        filter["price"] = {};
        if (req.query.priceMin) {
          filter["price"]["$gte"] = Number(req.query.priceMin);
        }
        if (req.query.priceMax) {
          filter["price"]["$lte"] = Number(req.query.priceMax);
        }
      }
      
      // Filter theo discount
      if (req.query.discount === "has-discount") {
        filter["promotion"] = { $exists: true, $ne: null, $gt: 0 };
      } else if (req.query.discount === "no-discount") {
        filter["$or"] = [
          { promotion: { $exists: false } },
          { promotion: null },
          { promotion: { $lte: 0 } }
        ];
      }
      
      // Filter đặc biệt cho User model
      if (Model == User) filter["role"] = { $ne: "admin" };

      let recordsTotal = 0;
      let recordsFiltered = 0;
      try {
        recordsTotal = await Model.countDocuments({});
      } catch (e) {
        console.warn("countDocuments total error:", e);
      }
      try {
        recordsFiltered = await Model.countDocuments(filter);
      } catch (e) {
        console.warn("countDocuments filtered error:", e);
      }
      
      // Build query với populate nếu cần (pre hook sẽ tự động populate)
      let query = Model.find(filter)
        .sort({ _id: -1 })
        .skip(Number(req.query.start) || 0)
        .limit(Number(req.query.length) || 10);
      
      // Populate author cho News model
      if (Model === News) {
        query = query.populate({
          path: "author",
          select: "name email",
        });
      }
      
      // Không dùng lean() để pre hook populate hoạt động
      const results = await query;

      // Fallback nếu count lỗi hoặc trả về 0 nhưng vẫn có data
      if ((!recordsTotal || recordsTotal < results.length) && results.length > 0) {
        recordsTotal = results.length;
      }
      if ((!recordsFiltered || recordsFiltered < results.length) && results.length > 0) {
        recordsFiltered = results.length;
      }
      const data = {
        draw: Number(req.query.draw) || 1,
        recordsFiltered: recordsFiltered,
        recordsTotal: recordsTotal,
        data: results,
      };
      res.status(200).json(data);
    } catch (error) {
      console.error("getTable error:", error);
      return res.status(500).json({
        draw: Number(req.query.draw) || 1,
        recordsFiltered: 0,
        recordsTotal: 0,
        data: [],
        error: error.message,
      });
    }
  });
exports.checkPermission = (Model) =>
  catchAsync(async (req, res, next) => {
    // 1) Get review id from param and findById to get review information
    const doc = await Model.findById(req.params.id);
    // 2) if user is owner, allow to update or delete data
    if (req.user.id != doc.user._id && req.user.role == "user") {
      return next(new AppError("Bạn không có quyền để thực hiện", 403));
    }
    if (Model == Order) {
      req.order = doc;
    }
    next();
  });
