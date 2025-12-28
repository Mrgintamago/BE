const loadData = async () => {
  try {
    $("#sample_data").DataTable({
      processing: true,
      serverSide: true,
      serverMethod: "get",
      ajax: {
        url: "api/v1/categories/getTableCategory",
      },
      columns: [
        {
          data: "name",
          render: function (data) {
            const value = data.length > 39 ? data.slice(0, 40) + "..." : data;
            return '<div class= "my-3">' + value + "</div>";
          },
        },
        {
          data: null,
          render: function (row) {
            const currentRole = typeof currentUserRole !== "undefined" ? currentUserRole : "";
            const canEdit = currentRole === "super_admin" || currentRole === "admin";
            
            let buttons = [];
            if (canEdit) {
              buttons.push('<button type="button" class="btn btn-primary btn-sm mr-1 edit" data-id="' + row._id + '"><i class="fa fa-edit"></i></button>');
              buttons.push('<button type="button" class="btn btn-danger btn-sm delete" data-id="' + row._id + '"><i class="fa fa-trash-alt"></i></button>');
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
  $("#dynamic_modal_title").text("Thêm nhà cung cấp");
  $("#sample_form")[0].reset();
  $("#action").val("Add");
  $("#id").val("");

  $("#action_button").text("Thêm");
  $("#action_modal").modal("show");
});
$(document).on("click", ".edit", function () {
  const id = $(this).data("id");

  $("#dynamic_modal_title").text("Chỉnh sửa nhà cung cấp");

  $("#action").val("Edit");

  $("#action_button").text("Cập nhật");

  $("#action_modal").modal("show");
  $.ajax({
    url: `/api/v1/categories/${id}`,
    method: "GET",
    success: function (data) {
      const category = data.data.data;
      $("#name").val(category.name);
      $("#id").val(category._id);
    },
  });
});

$(document).on("click", ".delete", function () {
  const id = $(this).data("id");

  if (confirm("Bạn có chắc chắn muốn xóa nhà cung cấp này?")) {
    try {
      $.ajax({
        url: `/api/v1/categories/${id}`,
        method: "delete",
        success: function (data) {
          showAlert("success", `Xóa nhà cung cấp thành công`);
          reloadData();
        },
      });
    } catch (error) {
      return showAlert("error", "Đã có lỗi xảy ra");
    }
  }
});

$("#sample_form").on("submit", async (e) => {
  e.preventDefault();
  const action = $("#action").val();
  const method = action == "Add" ? "POST" : "PATCH";
  const data = { name: $("#name").val() };
  const id = $("#id").val();
  const url = `/api/v1/categories/${id}`;
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
        const actionText = action === "Add" ? "Thêm" : "Cập nhật";
        showAlert("success", `${actionText} nhà cung cấp thành công!`);
        reloadData();
      },
    });
  } catch (error) {
    $("#action_button").attr("disabled", false);
    return showAlert("error", error.responseJSON.message);
  }
});

$(document).ready(function () {
  $("select").select2({
    theme: "bootstrap-5",
  });
  loadData();
  $(".navbar-nav li").removeClass("active");
  $(".navbar-nav li")[6].className = "nav-item active";
});
