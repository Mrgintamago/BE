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
        url: "api/v1/comments/getTableComment",
      },
      columns: [
        {
          data: "user",
          render: function (data) {
            return '<div class="my-3">' + (data?.name || "N/A") + "</div>";
          },
        },
        {
          data: "product",
          render: function (data) {
            const productName = data?.title || "N/A";
            const shortName = productName.length > 30 ? productName.substring(0, 30) + "..." : productName;
            return '<div class="my-3" title="' + productName + '">' + shortName + "</div>";
          },
        },
        {
          data: "comment",
          render: function (data) {
            const shortComment = data.length > 50 ? data.substring(0, 50) + "..." : data;
            return '<div class="my-3" title="' + data + '">' + shortComment + "</div>";
          },
        },
        {
          data: "like",
          render: function (data) {
            return '<div class="my-3">' + (data?.length || 0) + "</div>";
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
            const canDelete = currentRole === "super_admin" || currentRole === "admin";
            
            let buttons = [];
            buttons.push('<button type="button" class="btn btn-info btn-sm mr-1 view" data-id="' + row._id + '"><i class="fa fa-eye"></i></button>');
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

// View comment details
$(document).on("click", ".view", function () {
  const id = $(this).data("id");
  
  $.ajax({
    url: `/api/v1/comments/${id}`,
    method: "GET",
    success: function (data) {
      const comment = data.data.data;
      $("#view_user").text(comment.user?.name || "N/A");
      $("#view_product").text(comment.product?.title || "N/A");
      $("#view_comment").text(comment.comment || "");
      $("#view_likes").text(comment.like?.length || 0);
      const date = new Date(comment.createdAt);
      $("#view_createdAt").text(date.toLocaleString("vi-VN"));
      
      // Store ID for delete
      $("#delete_btn").data("id", id);
      
      $("#dynamic_modal_title").text("Chi tiết câu hỏi/trả lời");
      $("#action_modal").modal("show");
    },
    error: function(xhr) {
      showAlert("error", xhr.responseJSON?.message || "Không thể tải thông tin");
    }
  });
});

// Delete comment
$(document).on("click", ".delete, #delete_btn", function () {
  const id = $(this).data("id");

  if (confirm("Bạn có chắc chắn muốn xóa câu hỏi/trả lời này?")) {
    try {
      $.ajax({
        url: `/api/v1/comments/${id}`,
        method: "delete",
        headers: {
          'Authorization': 'Bearer ' + getCookie('jwt')
        },
        success: function (data) {
          showAlert("success", "Xóa thành công");
          $("#action_modal").modal("hide");
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
  // Find comment menu item and set active
  $(".navbar-nav li").each(function(index) {
    if ($(this).find("a").attr("href") === "/comment") {
      $(this).addClass("active");
    }
  });
});

