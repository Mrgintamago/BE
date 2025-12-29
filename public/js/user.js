const err_src = "/images/error-user.jpg";

const loadData = async () => {
  try {
    $("#sample_data").DataTable({
      processing: true,
      serverSide: true,
      serverMethod: "get",
      ajax: {
        url: "api/v1/users/getTableUser",
      },
      columns: [
        {
          data: "avatar",
          render: function (data) {
            return (
              `<img src="` +
              data +
              `" alt=""height="65" width="65" onerror="this.src='` +
              err_src +
              `';" style="border-radius: 0.275rem;" >`
            );
          },
        },
        {
          data: "name",
          render: function (data) {
            const value = data.length > 39 ? data.slice(0, 40) + "..." : data;
            return '<div class= "my-3">' + value + "</div>";
          },
        },
        {
          data: "email",
          render: function (data) {
            return '<div class= "my-3">' + data + "</div>";
          },
        },
        {
          data: "active",
          render: function (data) {
            return '<div class= "my-3">' + data + "</div>";
          },
        },
        {
          data: null,
          render: function (row) {
            const currentRole = typeof currentUserRole !== "undefined" ? currentUserRole : "";
            const isSuperAdmin = currentRole === "super_admin";
            const isAdmin = currentRole === "admin";
            const canView = isSuperAdmin || isAdmin;
            const canBan = isSuperAdmin || isAdmin; // Admin và Super Admin có thể ban
            const canDelete = isSuperAdmin; // Chỉ Super Admin có thể xóa
            
            let buttons = [];
            
            // View button - Super Admin và Admin
            if (canView) {
              buttons.push('<button type="button" class="btn btn-primary btn-sm mr-1 edit" data-id="' + row._id + '"><i class="fa fa-eye"></i></button>');
            }
            
            // Ban/Unban button - Super Admin và Admin
            if (canBan) {
              const btnBanUser = row.active == "ban"
                ? '<button type="button" class="btn btn-warning btn-sm ban" data-id="' + row._id + '"><i class="fa fa-unlock-alt"></i></button>'
                : '<button type="button" class="btn btn-danger btn-sm ban" data-id="' + row._id + '"><i class="fa fa-user-lock"></i></button>';
              buttons.push(btnBanUser);
            }
            
            // History button - Super Admin và Admin
            if (canView) {
              buttons.push('<button type="button" class="btn btn-info btn-sm ml-1 history" data-id="' + row._id + '"><i class="fa fa-shopping-cart"></i></button>');
            }
            
            // Delete button - Chỉ Super Admin
            if (canDelete) {
              buttons.push('<button type="button" class="btn btn-danger btn-sm ml-1 delete-user" data-id="' + row._id + '"><i class="fa fa-trash"></i></button>');
            }
            
            return `<div class= "my-3">${buttons.join("")}</div>`;
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

$("#add_data").click(function () {
  $("#dynamic_modal_title").text("Add User");
  $("#sample_form")[0].reset();
  $("#action").val("Add");
  $("#id").val("");

  $("#action_button").text("Add");
  $("#action_modal").modal("show");
  $(".add-only").show();
  $(".edit-show").show();
});
$(document).on("click", ".edit", function () {
  const id = $(this).data("id");
  const isSuperAdmin = typeof currentUserRole !== "undefined" && currentUserRole === "super_admin";

  // Reset modal to view mode
  $("#dynamic_modal_title").text("Thông tin người dùng");
  $("#action").val("View");
  $("#action_button").addClass("d-none");
  $("#edit_button").addClass("d-none");
  $(".edit-form").addClass("d-none");
  $(".edit-show").removeClass("d-none").show();
  $(".add-only").hide();

  // Show Edit button only for super_admin
  if (isSuperAdmin) {
    $("#edit_button").removeClass("d-none");
  }

  $("#action_modal").modal("show");
  $.ajax({
    url: `/api/v1/users/${id}`,
    method: "GET",
    success: function (data) {
      const user = data.data.data;
      $("#view_name").text(user.name || "-");
      $("#view_email").text(user.email || "-");
      $("#view_phone").text(user.phone || "-");
      $("#view_active").text(user.active || "-");
      $("#view_role").text(user.role || "-");
      $("#view_gender").text(user.gender || "-");
      $("#view_dob").text(user.dateOfBirth || "-");
      $("#view_balance").text(
        typeof user.balance === "number"
          ? user.balance.toLocaleString("vi-VN") + " VND"
          : "-"
      );
      $("#view_createdAt").text(
        user.createdAt ? new Date(user.createdAt).toLocaleString("vi-VN") : "-"
      );

      // Populate edit form fields
      $("#edit_name").val(user.name || "");
      $("#edit_email").val(user.email || "");
      $("#edit_phone").val(user.phone || "");
      $("#edit_active").val(user.active || "active");
      $("#edit_role").val(user.role || "user");
      $("#edit_gender").val(user.gender || "");
      $("#edit_dob").val(user.dateOfBirth || "");
      $("#edit_password").val("");
      $("#edit_passwordConfirm").val("");

      // Render addresses
      $("#view_addresses").empty();
      const addresses = user.address || [];
      if (!addresses.length) {
        $("#view_addresses").append("<li>Không có địa chỉ</li>");
      } else {
        addresses.forEach((addr) => {
          const line = [
            addr.name,
            addr.phone,
            addr.detail,
            addr.ward,
            addr.district,
            addr.province,
            addr.country,
          ]
            .filter(Boolean)
            .join(", ");
          const tag = addr.setDefault ? ' <span class="badge bg-success ms-1">Mặc định</span>' : "";
          $("#view_addresses").append(`<li>${line || "-"}${tag}</li>`);
        });
      }
      $("#id").val(user._id);
    },
    error: function () {
      showAlert("error", "Không thể tải thông tin người dùng");
    },
  });
});

// Switch to edit mode
$("#edit_button").on("click", function () {
  $("#dynamic_modal_title").text("Chỉnh sửa người dùng");
  $("#action").val("Edit");
  $(".edit-show").addClass("d-none");
  $(".edit-form").removeClass("d-none");
  $("#edit_button").addClass("d-none");
  $("#action_button").removeClass("d-none");
});

$(document).on("click", ".ban", function () {
  const id = $(this).data("id");
  const data =
    this.children[0].className == "fa fa-user-lock"
      ? { active: "ban" }
      : { active: "active" };
  const action =
    this.children[0].className == "fa fa-user-lock" ? "Ban" : "UnBan";
  if (confirm("Are you sure you want to ban this user?")) {
    try {
      $.ajax({
        url: `/api/v1/users/${id}`,
        method: "patch",
        data,
        success: function (data) {
          showAlert("success", `${action} ${data.data.data.name} Successfully`);
          reloadData();
        },
      });
    } catch (error) {
      return showAlert("error", error.responseJSON.message);
    }
  }
});

$(document).on("click", ".delete-user", function () {
  const id = $(this).data("id");
  if (confirm("Bạn có chắc muốn xóa tài khoản này?")) {
    $.ajax({
      url: `/api/v1/users/${id}`,
      method: "delete",
      success: function () {
        showAlert("success", `Xóa tài khoản thành công`);
        reloadData();
      },
      error: function (xhr) {
        const errorMsg = xhr.responseJSON?.message || "Xóa tài khoản thất bại";
        showAlert("error", errorMsg);
      },
    });
  }
});

$("#sample_form").on("submit", async (e) => {
  e.preventDefault();
  const action = $("#action").val();
  if (action === "View") {
    return;
  }
  
  const id = $("#id").val();
  
  if (action === "Edit") {
    // Update user information
    const updateData = {
      name: $("#edit_name").val(),
      email: $("#edit_email").val(),
      phone: $("#edit_phone").val(),
      active: $("#edit_active").val(),
      role: $("#edit_role").val(),
      gender: $("#edit_gender").val() || null,
      dateOfBirth: $("#edit_dob").val() || null,
    };

    try {
      $("#action_button").attr("disabled", "disabled");
      
      // Update user info
      await $.ajax({
        url: `/api/v1/users/${id}`,
        method: "PATCH",
        data: updateData,
      });

      // Update password if provided
      const password = $("#edit_password").val();
      const passwordConfirm = $("#edit_passwordConfirm").val();
      
      if (password && passwordConfirm) {
        if (password !== passwordConfirm) {
          $("#action_button").attr("disabled", false);
          return showAlert("error", "Mật khẩu xác nhận không khớp!");
        }
        if (password.length < 8) {
          $("#action_button").attr("disabled", false);
          return showAlert("error", "Mật khẩu phải có ít nhất 8 ký tự!");
        }
        
        await $.ajax({
          url: `/api/v1/users/${id}/updatePassword`,
          method: "PATCH",
          data: {
            password: password,
            passwordConfirm: passwordConfirm,
          },
        });
      }

      $("#action_button").attr("disabled", false);
      showAlert("success", "Cập nhật thông tin người dùng thành công!");
      reloadData();
      
      // Reload user data and switch back to view mode
      try {
        const userData = await $.ajax({
          url: `/api/v1/users/${id}`,
          method: "GET",
        });
        
        const user = userData.data.data;
        // Update view fields
        $("#view_name").text(user.name || "-");
        $("#view_email").text(user.email || "-");
        $("#view_phone").text(user.phone || "-");
        $("#view_active").text(user.active || "-");
        $("#view_role").text(user.role || "-");
        $("#view_gender").text(user.gender || "-");
        $("#view_dob").text(user.dateOfBirth || "-");
        $("#view_balance").text(
          typeof user.balance === "number"
            ? user.balance.toLocaleString("vi-VN") + " VND"
            : "-"
        );
        $("#view_createdAt").text(
          user.createdAt ? new Date(user.createdAt).toLocaleString("vi-VN") : "-"
        );

        // Update edit form fields
        $("#edit_name").val(user.name || "");
        $("#edit_email").val(user.email || "");
        $("#edit_phone").val(user.phone || "");
        $("#edit_active").val(user.active || "active");
        $("#edit_role").val(user.role || "user");
        $("#edit_gender").val(user.gender || "");
        $("#edit_dob").val(user.dateOfBirth || "");
        $("#edit_password").val("");
        $("#edit_passwordConfirm").val("");

        // Render addresses
        $("#view_addresses").empty();
        const addresses = user.address || [];
        if (!addresses.length) {
          $("#view_addresses").append("<li>Không có địa chỉ</li>");
        } else {
          addresses.forEach((addr) => {
            const line = [
              addr.name,
              addr.phone,
              addr.detail,
              addr.ward,
              addr.district,
              addr.province,
              addr.country,
            ]
              .filter(Boolean)
              .join(", ");
            const tag = addr.setDefault ? ' <span class="badge bg-success ms-1">Mặc định</span>' : "";
            $("#view_addresses").append(`<li>${line || "-"}${tag}</li>`);
          });
        }
        
        // Switch back to view mode
        $("#dynamic_modal_title").text("Thông tin người dùng");
        $("#action").val("View");
        $(".edit-show").removeClass("d-none").show();
        $(".edit-form").addClass("d-none");
        if (typeof currentUserRole !== "undefined" && currentUserRole === "super_admin") {
          $("#edit_button").removeClass("d-none");
        }
        $("#action_button").addClass("d-none");
      } catch (reloadError) {
        console.error("Error reloading user data:", reloadError);
      }
    } catch (error) {
      $("#action_button").attr("disabled", false);
      return showAlert("error", error.responseJSON?.message || "Cập nhật thất bại!");
    }
    return;
  }

  // Old code for Add action (if needed in future)
  const method = action == "Add" ? "POST" : "PATCH";
  const data =
    action == "Add"
      ? {
          name: $("#name").val(),
          email: $("#email").val(),
          password: $("#password").val(),
          passwordConfirm: $("#passwordConfirm").val(),
        }
      : {
          name: $("#name").val(),
          email: $("#email").val(),
          phone: $("#phone").val(),
          active: $("#active").val(),
        };
  const url = id != "" ? `/api/v1/users/${id}` : `/api/v1/users/signup`;
  try {
    await $.ajax({
      url,
      method,
      data,
      beforeSend: function () {
        $("#action_button").attr("disabled", "disabled");
      },
      success: (data) => {
        $("#action_button").attr("disabled", false);
        $("#action_modal").modal("hide");
        showAlert("success", `${action} User successfully!`);
        if (action == "Add") window.location.reload();
        else reloadData();
      },
    });
  } catch (error) {
    $("#action_button").attr("disabled", false);
    return showAlert("error", error.responseJSON.message);
  }
});

// xem lịch sử đơn hàng
$(document).on("click", ".history", function () {
  const id = $(this).data("id");
  $("#order_history_body").empty();
  $("#order_history_empty").addClass("d-none");
  $.ajax({
    url: `/api/v1/orders?user=${id}`,
    method: "GET",
    success: function (res) {
      const orders = res.data?.data || [];
      if (!orders.length) {
        $("#order_history_empty").removeClass("d-none");
      } else {
        orders.forEach((order) => {
          const date = new Date(order.createdAt).toLocaleString();
          const status = order.status;
          const price = order.totalPrice;
          const row = `<tr>
              <td>${order._id || ""}</td>
              <td>${date}</td>
              <td>${status}</td>
              <td>${price} VND</td>
            </tr>`;
          $("#order_history_body").append(row);
        });
      }
      $("#order_modal").modal("show");
    },
    error: function (err) {
      $("#order_history_empty").removeClass("d-none").text("Không thể tải lịch sử đơn hàng");
      $("#order_modal").modal("show");
    },
  });
});

// Reset modal when closed
$("#action_modal").on("hidden.bs.modal", function () {
  // Reset to view mode
  $("#dynamic_modal_title").text("Thông tin người dùng");
  $("#action").val("View");
  $("#action_button").addClass("d-none");
  $("#edit_button").addClass("d-none");
  $(".edit-form").addClass("d-none");
  $(".edit-show").removeClass("d-none").show();
  $(".add-only").hide();
  
  // Clear form data
  $("#sample_form")[0].reset();
  $("#id").val("");
  $("#view_name").text("-");
  $("#view_email").text("-");
  $("#view_phone").text("-");
  $("#view_active").text("-");
  $("#view_role").text("-");
  $("#view_gender").text("-");
  $("#view_dob").text("-");
  $("#view_balance").text("-");
  $("#view_createdAt").text("-");
  $("#view_addresses").empty();
});

$(document).ready(function () {
  $("select").select2({
    theme: "bootstrap-5",
  });
  loadData();
  $(".navbar-nav li").removeClass("active");
  $(".navbar-nav li")[1].className = "nav-item active";
});
