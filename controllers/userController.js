const User = require("./../models/userModel");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const factory = require("./handlerFactory");
const mongoose = require("mongoose");

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError("Trang này không dùng để thay đổi mật khẩu", 400));
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated,this is all field can update:
  const filteredBody = filterObj(
    req.body,
    "name",
    "avatar",
    "gender",
    "dateOfBirth",
    "phone"
  );

  // 3) Xử lý các trường có thể null/empty: nếu giá trị là null hoặc empty string, set thành null
  if (filteredBody.phone !== undefined) {
    filteredBody.phone = filteredBody.phone && filteredBody.phone.trim() !== "" ? filteredBody.phone : null;
  }
  if (filteredBody.dateOfBirth !== undefined) {
    filteredBody.dateOfBirth = filteredBody.dateOfBirth && filteredBody.dateOfBirth.trim() !== "" ? filteredBody.dateOfBirth : null;
  }
  if (filteredBody.gender !== undefined) {
    filteredBody.gender = filteredBody.gender && filteredBody.gender.trim() !== "" ? filteredBody.gender : null;
  }

  // 4) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: false, // Tắt validators để cho phép null
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: "ban" });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: "error",
    message: "This route is not defined! Please use /signup instead",
  });
};
exports.createAddress = catchAsync(async (req, res) => {
  const user = req.user;
  let arr = user.address;
  let index = arr.length;
  const data = {
    name: req.body.name,
    phone: req.body.phone,
    country: req.body.country,
    province: req.body.province,
    ward: req.body.ward,
    detail: req.body.detail,
  };
  
  // Nếu đây là địa chỉ đầu tiên hoặc người dùng chọn đặt làm mặc định
  if (index == 0 || req.body.setDefault === true) {
    data.setDefault = true;
    // Nếu có địa chỉ khác, set tất cả thành false
    if (arr.length > 0) {
      arr.forEach((addr) => {
        addr.setDefault = false;
      });
    }
  } else {
    data.setDefault = false;
  }
  
  arr.push(data);
  user.address = arr;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    message: "You have already added address successfully.",
    data: user,
  });
});
exports.updateAddress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  let addressId = req.body.id;
  
  if (addressId === null || addressId === undefined || addressId === '') {
    return res.status(400).json({
      status: "error",
      message: "Vui lòng chọn địa chỉ",
    });
  }
  
  const user = await User.findById(userId);
  
  if (!user.address || user.address.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Bạn chưa có địa chỉ nào",
    });
  }
  
  // Handle both array index (number) and ObjectId (string)
  let addressIndex = -1;
  
  if (typeof addressId === 'number') {
    // Frontend sent array index directly
    addressIndex = addressId;
  } else if (typeof addressId === 'string') {
    // Frontend sent ObjectId string
    try {
      const objectId = new mongoose.Types.ObjectId(addressId);
      addressIndex = user.address.findIndex(addr => addr._id.equals(objectId));
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message: "ID địa chỉ không hợp lệ",
      });
    }
  }
  
  if (addressIndex === -1) {
    return res.status(400).json({
      status: "error",
      message: "Không tìm thấy địa chỉ",
    });
  }
  
  const data = {
    name: req.body.name,
    phone: req.body.phone,
    country: req.body.country,
    province: req.body.province,
    ward: req.body.ward,
    detail: req.body.detail,
    setDefault: req.body.setDefault || false,
  };
  
  // Nếu đặt làm mặc định, set tất cả địa chỉ khác thành false
  if (data.setDefault === true) {
    user.address.forEach((addr, index) => {
      addr.setDefault = (index === addressIndex);
    });
  }
  
  // Update the address at found index
  user.address[addressIndex] = {
    _id: user.address[addressIndex]._id, // Preserve _id
    ...data
  };
  
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    message: "Cập nhật địa chỉ thành công",
  });
});
exports.deleteAddress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  let addressId = req.body.id;
  
  if (addressId === null || addressId === undefined || addressId === '') {
    return res.status(400).json({
      status: "error",
      message: "Vui lòng chọn địa chỉ",
    });
  }
  
  const user = await User.findById(userId);
  
  if (!user.address || user.address.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Bạn chưa có địa chỉ nào",
    });
  }
  
  // Handle both array index (number) and ObjectId (string)
  let addressIndex = -1;
  
  if (typeof addressId === 'number') {
    // Frontend sent array index directly
    addressIndex = addressId;
  } else if (typeof addressId === 'string') {
    // Frontend sent ObjectId string
    try {
      const objectId = new mongoose.Types.ObjectId(addressId);
      addressIndex = user.address.findIndex(addr => addr._id.equals(objectId));
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message: "ID địa chỉ không hợp lệ",
      });
    }
  }
  
  if (addressIndex === -1) {
    return res.status(400).json({
      status: "error",
      message: "Không tìm thấy địa chỉ",
    });
  }
  
  const isDefault = user.address[addressIndex].setDefault;
  user.address.splice(addressIndex, 1);
  
  // If deleted address was default, set first address as default
  if (isDefault && user.address.length > 0) {
    user.address[0].setDefault = true;
  }
  
  await user.save({ validateBeforeSave: false });
  return res.status(200).json({
    status: "success",
    message: "Xóa địa chỉ thành công",
    data: user,
  });
});
exports.setDefaultAddress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  let addressId = req.body.id;
  
  console.log("[SET DEFAULT ADDRESS] 📝 Request - addressId:", addressId, "type:", typeof addressId);
  
  if (addressId === null || addressId === undefined || addressId === '') {
    return res.status(400).json({
      status: "error",
      message: "Vui lòng chọn địa chỉ",
    });
  }
  
  // Re-fetch user from DB
  const user = await User.findById(userId);
  
  if (!user.address || user.address.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Bạn chưa có địa chỉ nào",
    });
  }
  
  console.log("[SET DEFAULT ADDRESS] User has", user.address.length, "addresses");
  
  // Handle both array index (number) and ObjectId (string)
  let addressIndex = -1;
  
  if (typeof addressId === 'number') {
    // Frontend sent array index directly
    console.log("[SET DEFAULT ADDRESS] 📝 Received array index:", addressId);
    addressIndex = addressId;
  } else if (typeof addressId === 'string') {
    // Frontend sent ObjectId string
    console.log("[SET DEFAULT ADDRESS] 📝 Received ObjectId string:", addressId);
    try {
      const objectId = new mongoose.Types.ObjectId(addressId);
      addressIndex = user.address.findIndex(addr => {
        const matches = addr._id.equals(objectId);
        console.log(`Comparing ${addr._id.toString()} equals ${objectId.toString()} ? ${matches}`);
        return matches;
      });
    } catch (error) {
      console.log("[SET DEFAULT ADDRESS] ❌ Invalid ObjectId format:", addressId);
      return res.status(400).json({
        status: "error",
        message: "ID địa chỉ không hợp lệ",
      });
    }
  }
  
  if (addressIndex === -1) {
    console.log("[SET DEFAULT ADDRESS] ❌ Address not found");
    console.log("Available IDs:", user.address.map(a => a._id.toString()));
    console.log("Looking for:", addressId.toString());
    return res.status(400).json({
      status: "error",
      message: "Không tìm thấy địa chỉ",
    });
  }
  
  // Reset all to false, then set the selected one to true
  user.address.forEach((addr, idx) => {
    addr.setDefault = (idx === addressIndex);
  });
  
  await user.save({ validateBeforeSave: false });
  
  return res.status(200).json({
    status: "success",
    message: "Đặt địa chỉ mặc định thành công",
    data: user,
  });
});
exports.getUserAddress = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "fail",
        message: "User not authenticated",
      });
    }
    const address = req.user.address || [];
    res.status(200).json({
      status: "success",
      data: {
        address,
      },
      message: "Get all user address successfully.",
    });
  } catch (error) {
    console.error("getUserAddress error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Get all admin users (super_admin, admin, manager, sales_staff)
exports.getAllAdminUsers = catchAsync(async (req, res, next) => {
  const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
  // Set filter for role
  req.query.role = adminRoles.join(",");
  next();
}, factory.getAll(User));

// Get all customer users (user, employee)
exports.getAllCustomerUsers = catchAsync(async (req, res, next) => {
  const customerRoles = ["user", "employee"];
  // Set filter for role
  req.query.role = customerRoles.join(",");
  next();
}, factory.getAll(User));

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);

// Update password for another user (Super Admin only)
exports.updateUserPassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.params.id).select("+password");

  if (!user) {
    return next(new AppError("Không tìm thấy người dùng", 404));
  }

  // 2) Update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 3) Remove password from output
  user.password = undefined;

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
    message: "Cập nhật mật khẩu thành công",
  });
});

exports.deleteUser = factory.deleteOne(User);
exports.getTableUser = factory.getTable(User);

// Get table for admin users only (super_admin, admin, manager, sales_staff)
exports.getTableAdminUsers = catchAsync(async (req, res, next) => {
  try {
    const filter = {};
    const adminRoles = ["super_admin", "admin", "manager", "sales_staff"];
    filter["role"] = { $in: adminRoles };

    // Search functionality
    if (req.query.search && req.query.search.value) {
      const searchStr = req.query.search.value.trim();
      if (searchStr) {
        const escapedKeyword = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter["$or"] = [
          { name: { $regex: escapedKeyword, $options: "i" } },
          { email: { $regex: escapedKeyword, $options: "i" } },
        ];
      }
    }

    const recordsTotal = await User.countDocuments({ role: { $in: adminRoles } });
    const recordsFiltered = await User.countDocuments(filter);

    let query = User.find(filter)
      .sort({ _id: -1 })
      .skip(Number(req.query.start) || 0)
      .limit(Number(req.query.length) || 10);

    const results = await query;

    const data = {
      draw: Number(req.query.draw) || 1,
      recordsFiltered: recordsFiltered,
      recordsTotal: recordsTotal,
      data: results,
    };

    res.status(200).json(data);
  } catch (error) {
    console.error("getTableAdminUsers error:", error);
    return res.status(500).json({
      draw: Number(req.query.draw) || 1,
      recordsFiltered: 0,
      recordsTotal: 0,
      data: [],
      error: error.message,
    });
  }
});

// Get table for customer users only (user, employee)
exports.getTableCustomerUsers = catchAsync(async (req, res, next) => {
  try {
    const filter = {};
    const customerRoles = ["user", "employee"];
    filter["role"] = { $in: customerRoles };

    // Search functionality
    if (req.query.search && req.query.search.value) {
      const searchStr = req.query.search.value.trim();
      if (searchStr) {
        const escapedKeyword = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter["$or"] = [
          { name: { $regex: escapedKeyword, $options: "i" } },
          { email: { $regex: escapedKeyword, $options: "i" } },
        ];
      }
    }

    const recordsTotal = await User.countDocuments({ role: { $in: customerRoles } });
    const recordsFiltered = await User.countDocuments(filter);

    let query = User.find(filter)
      .sort({ _id: -1 })
      .skip(Number(req.query.start) || 0)
      .limit(Number(req.query.length) || 10);

    const results = await query;

    const data = {
      draw: Number(req.query.draw) || 1,
      recordsFiltered: recordsFiltered,
      recordsTotal: recordsTotal,
      data: results,
    };

    res.status(200).json(data);
  } catch (error) {
    console.error("getTableCustomerUsers error:", error);
    return res.status(500).json({
      draw: Number(req.query.draw) || 1,
      recordsFiltered: 0,
      recordsTotal: 0,
      data: [],
      error: error.message,
    });
  }
});
