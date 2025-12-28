const loadData = async () => {
  try {
    // Destroy existing DataTable if exists
    if ($.fn.DataTable.isDataTable("#sample_data")) {
      $("#sample_data").DataTable().destroy();
    }
    
    $("#sample_data").DataTable({
      processing: true,
      serverSide: true,
      serverMethod: "get",
      ajax: {
        url: "api/v1/partner-registrations/table",
      },
      columns: [
        {
          data: "companyName",
          render: function (data) {
            const shortName = data.length > 30 ? data.substring(0, 30) + "..." : data;
            return '<div class="my-3" title="' + data + '">' + shortName + "</div>";
          },
        },
        {
          data: "contactPerson",
          render: function (data) {
            return '<div class="my-3">' + (data || "-") + "</div>";
          },
        },
        {
          data: "email",
          render: function (data) {
            return '<div class="my-3">' + (data || "-") + "</div>";
          },
        },
        {
          data: "phone",
          render: function (data) {
            return '<div class="my-3">' + (data || "-") + "</div>";
          },
        },
        {
          data: "businessType",
          render: function (data) {
            const types = {
              "retail": "Bán lẻ",
              "wholesale": "Bán sỉ",
              "online": "Bán hàng online",
              "other": "Khác"
            };
            return '<div class="my-3">' + (types[data] || data) + "</div>";
          },
        },
        {
          data: "status",
          render: function (data) {
            const statuses = {
              "pending": { class: "status-pending", text: "Chờ xử lý" },
              "contacted": { class: "status-contacted", text: "Đã liên hệ" },
              "rejected": { class: "status-rejected", text: "Từ chối" }
            };
            const status = statuses[data] || { class: "status-pending", text: data };
            return '<div class="my-3"><span class="status-badge ' + status.class + '">' + status.text + "</span></div>";
          },
        },
        {
          data: "createdAt",
          render: function (data) {
            const date = new Date(data);
            return '<div class="my-3">' + date.toLocaleString("vi-VN") + "</div>";
          },
        },
        {
          data: null,
          render: function (row) {
            const currentRole = typeof currentUserRole !== "undefined" ? currentUserRole : "";
            const canEdit = currentRole === "super_admin" || currentRole === "admin" || currentRole === "manager";
            const canDelete = currentRole === "super_admin" || currentRole === "admin";
            
            let buttons = [];
            if (canEdit) {
              buttons.push('<button type="button" class="btn btn-primary btn-sm mr-1 edit" data-id="' + row._id + '"><i class="fa fa-edit"></i></button>');
            }
            if (canDelete) {
              buttons.push('<button type="button" class="btn btn-danger btn-sm delete" data-id="' + row._id + '"><i class="fa fa-trash-alt"></i></button>');
            }
            return `<div class="my-3">${buttons.join("")}</div>`;
          },
        },
      ],
    });

    showAlert("success", "Load Data successfully!");
  } catch (err) {
    showAlert("error", err);
  }
};

function reloadData() {
  $("#sample_data").DataTable().ajax.reload();
}

// Edit partner registration
$(document).on("click", ".edit", function () {
  const id = $(this).data("id");

  $("#dynamic_modal_title").text("Chi tiết đăng ký đối tác");
  $("#action").val("Edit");
  $("#action_button").text("Cập nhật");
  $("#action_modal").modal("show");
  
  const token = getCookie("jwt");
  const headers = token ? { Authorization: "Bearer " + token } : {};

  $.ajax({
    url: `/api/v1/partner-registrations/${id}`,
    method: "GET",
    headers,
    success: function (data) {
      console.log("API Response:", data);
      const registration = data.data?.data || data.data || data;
      console.log("Registration data:", registration);
      
      if (!registration) {
        showAlert("error", "Không tìm thấy dữ liệu");
        return;
      }
      
      $("#id").val(registration._id || registration.id || id);
      $("#view_companyName").text(registration.companyName || "-");
      $("#view_contactPerson").text(registration.contactPerson || "-");
      $("#view_email").text(registration.email || "-");
      $("#view_phone").text(registration.phone || "-");
      $("#view_address").text(registration.address || "-");
      
      const businessTypes = {
        "retail": "Bán lẻ",
        "wholesale": "Bán sỉ",
        "online": "Bán hàng online",
        "other": "Khác"
      };
      $("#view_businessType").text(businessTypes[registration.businessType] || registration.businessType || "-");
      $("#view_message").text(registration.message || "-");
      
      // Set status - chỉ có 3 trạng thái: pending, contacted, rejected
      const status = registration.status || "pending";
      $("#edit_status").val(status);
      $("#edit_notes").val(registration.notes || "");
    },
    error: function(xhr) {
      console.error("Error loading registration:", xhr);
      showAlert("error", xhr.responseJSON?.message || "Không thể tải thông tin");
    }
  });
});

// Delete partner registration
$(document).on("click", ".delete", function () {
  const id = $(this).data("id");

  if (confirm("Bạn có chắc chắn muốn xóa đăng ký đối tác này?")) {
    try {
      $.ajax({
        url: `/api/v1/partner-registrations/${id}`,
        method: "delete",
        headers: {
          'Authorization': 'Bearer ' + getCookie('jwt')
        },
        success: function (data) {
          showAlert("success", "Xóa thành công");
          reloadData();
        },
        error: function(xhr) {
          showAlert("error", xhr.responseJSON?.message || "Không thể xóa");
        }
      });
    } catch (error) {
      return showAlert("error", "Đã có lỗi xảy ra");
    }
  }
});

// Update form submit
$("#sample_form").on("submit", async (e) => {
  e.preventDefault();
  const id = $("#id").val();
  
  if (!id) {
    showAlert("error", "Không tìm thấy ID đăng ký");
    return;
  }
  
  const url = `/api/v1/partner-registrations/${id}`;
  const data = {
    status: $("#edit_status").val(),
    notes: $("#edit_notes").val()
  };
  
  console.log("Updating registration:", id, data);
  
  try {
    const token = getCookie("jwt");
    const headers = token ? { Authorization: "Bearer " + token } : {};

    await $.ajax({
      url,
      method: "PATCH",
      data: JSON.stringify(data),
      headers,
      contentType: "application/json",
      processData: false,
      beforeSend: function () {
        $("#action_button").prop("disabled", true).text("Đang cập nhật...");
      },
      success: (response) => {
        console.log("Update success:", response);
        $("#action_button").prop("disabled", false).text("Cập nhật");
        $("#action_modal").modal("hide");
        showAlert("success", "Cập nhật thành công!");
        reloadData();
      },
      error: function(xhr) {
        console.error("Update error:", xhr);
        $("#action_button").prop("disabled", false).text("Cập nhật");
        const errorMsg = xhr.responseJSON?.message || xhr.responseJSON?.error?.message || "Đã có lỗi xảy ra";
        showAlert("error", errorMsg);
      }
    });
  } catch (error) {
    console.error("Update exception:", error);
    $("#action_button").prop("disabled", false).text("Cập nhật");
    showAlert("error", error.message || "Đã có lỗi xảy ra");
  }
});

// Get cookie function
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

$(document).ready(function () {
  loadData();
  $(".navbar-nav li").removeClass("active");
  // Find partner registration menu item and set active
  $(".navbar-nav li").each(function(index) {
    if ($(this).find("a").attr("href") === "/partner-registrations") {
      $(this).addClass("active");
    }
  });
});

