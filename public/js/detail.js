const changeStatus = async (id, data) => {
  try {
    // Dừng auto-refresh khi đang xử lý
    stopAutoRefresh();
    
    await $.ajax({
      url: `../api/v1/orders/${id}`,
      method: "PATCH",
      data,
      cache: false, // Không cache request
      success: function (response) {
        // Reload trang ngay lập tức để load thông tin mới
        // Thêm timestamp để bỏ qua cache
        const currentUrl = window.location.href.split('?')[0];
        window.location.href = currentUrl + '?t=' + new Date().getTime();
      },
      error: function (xhr, status, error) {
        // Bắt đầu lại auto-refresh nếu có lỗi
        startAutoRefresh();
        const errorMessage = xhr.responseJSON?.message || error || "Có lỗi xảy ra khi cập nhật trạng thái đơn hàng";
        showAlert("error", errorMessage);
      }
    });
  } catch (error) {
    // Bắt đầu lại auto-refresh nếu có lỗi
    startAutoRefresh();
    showAlert("error", error.message || "Có lỗi xảy ra khi cập nhật trạng thái đơn hàng");
  }
};
function cancelOrder(value) {
  if (confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) {
    const id = $(value).data("id");
    const data = { status: "Cancelled" };
    changeStatus(id, data);
  }
}
function acceptOrder(value) {
  const status = $(value).val();
  let message = "";
  if (status === "Waiting Goods") {
    message = "Bạn có chắc chắn muốn chấp nhận đơn hàng này không?";
  } else if (status === "Delivery") {
    message = "Bạn có chắc chắn đơn hàng đã được bàn giao cho đơn vị vận chuyển không?";
  } else if (status === "Success") {
    message = "Bạn có chắc chắn đơn hàng đã được giao thành công không?";
  } else {
    message = "Bạn có chắc chắn muốn cập nhật trạng thái đơn hàng không?";
  }
  if (confirm(message)) {
    const id = $(value).data("id");
    const data = { status: status };
    changeStatus(id, data);
  }
}
// Auto refresh trang mỗi 30 giây để load thông tin mới
let autoRefreshInterval;

function startAutoRefresh() {
  // Clear interval cũ nếu có
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // Set interval mới: refresh mỗi 30 giây
  autoRefreshInterval = setInterval(function() {
    // Chỉ refresh nếu không có modal hoặc dialog đang mở
    if (!document.querySelector('.modal.show') && !document.querySelector('.swal2-container')) {
      window.location.reload();
    }
  }, 30000); // 30 giây
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

$(document).ready(function () {
  $(".navbar-nav li").removeClass("active");
  $(".navbar-nav li")[2].className = "nav-item active";
  if ($("#status").val() == "Cancelled") $("#progress-bar").width("0%");
  if ($("#status").val() == "Processed") $("#progress-bar").width("5%");
  if ($("#status").val() == "Waiting Goods") $("#progress-bar").width("35%");
  if ($("#status").val() == "Delivery") $("#progress-bar").width("63%");
  if ($("#status").val() == "Success") $("#progress-bar").width("100%");
  
  // Bắt đầu auto refresh
  startAutoRefresh();
  
  // Dừng auto refresh khi trang bị ẩn (tab không active)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  });
  
  // Dừng auto refresh khi đóng trang
  window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
  });
});
