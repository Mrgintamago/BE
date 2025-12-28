// Định nghĩa permissions cho từng role
const permissions = {
  super_admin: {
    // Super Admin: Cấu hình & phân quyền - Full access
    users: ['view', 'create', 'update', 'delete', 'manage_roles'],
    products: ['view', 'create', 'update', 'delete'],
    categories: ['view', 'create', 'update', 'delete'],
    brands: ['view', 'create', 'update', 'delete'],
    orders: ['view', 'create', 'update', 'delete'],
    reviews: ['view', 'create', 'update', 'delete'],
    comments: ['view', 'create', 'update', 'delete'],
    news: ['view', 'create', 'update', 'delete'],
    partner_registrations: ['view', 'create', 'update', 'delete'],
    analytics: ['view'],
    dashboard: ['view'],
    locations: ['view', 'create', 'update', 'delete'],
    transactions: ['view'],
  },
  admin: {
    // Admin: Vận hành shop - Quản lý sản phẩm, đơn hàng, nhập kho
    users: ['view'],
    products: ['view', 'create', 'update', 'delete'],
    categories: ['view', 'create', 'update', 'delete'],
    brands: ['view', 'create', 'update', 'delete'],
    orders: ['view', 'update'],
    reviews: ['view', 'update', 'delete'],
    comments: ['view', 'update', 'delete'],
    news: ['view', 'create', 'update', 'delete'],
    partner_registrations: ['view', 'update'],
    analytics: ['view'],
    dashboard: ['view'],
    locations: ['view', 'create', 'update', 'delete'],
    transactions: ['view'],
  },
  manager: {
    // Manager: Báo cáo & duyệt - Xem báo cáo, duyệt đơn, duyệt đối tác
    products: ['view'],
    categories: ['view'],
    brands: ['view'],
    orders: ['view', 'update'], // Duyệt đơn hàng
    reviews: ['view'],
    comments: ['view'],
    news: ['view'],
    partner_registrations: ['view', 'update'], // Duyệt đăng ký đối tác
    analytics: ['view'],
    dashboard: ['view'],
    locations: ['view'],
    transactions: ['view'],
  },
  sales_staff: {
    // Sales Staff: Xử lý đơn & khách - Xử lý đơn hàng
    products: ['view'],
    categories: ['view'],
    brands: ['view'],
    orders: ['view', 'update'], // Xử lý đơn hàng
    reviews: ['view'],
    comments: ['view'],
    news: ['view'],
    partner_registrations: ['view'],
    analytics: ['view'],
    dashboard: ['view'],
    locations: ['view'],
    transactions: ['view'],
  },
};

// Kiểm tra permission
exports.hasPermission = (role, resource, action) => {
  if (!permissions[role]) return false;
  if (!permissions[role][resource]) return false;
  return permissions[role][resource].includes(action);
};

// Kiểm tra nhiều permissions (OR logic)
exports.hasAnyPermission = (role, resource, actions) => {
  if (!permissions[role]) return false;
  if (!permissions[role][resource]) return false;
  return actions.some(action => permissions[role][resource].includes(action));
};

// Kiểm tra tất cả permissions (AND logic)
exports.hasAllPermissions = (role, resource, actions) => {
  if (!permissions[role]) return false;
  if (!permissions[role][resource]) return false;
  return actions.every(action => permissions[role][resource].includes(action));
};

// Lấy tất cả permissions của một role
exports.getRolePermissions = (role) => {
  return permissions[role] || {};
};

// Kiểm tra xem role có phải admin role không
exports.isAdminRole = (role) => {
  return ['super_admin', 'admin', 'manager', 'sales_staff'].includes(role);
};

module.exports = permissions;

