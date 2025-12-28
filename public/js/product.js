const err_src = "/images/unnamed.jpg";
let dataTable;
const loadData = async () => {
  try {
    dataTable = $("#sample_data").DataTable({
      processing: true,
      serverSide: true,
      serverMethod: "get",
      ajax: {
        url: "api/v1/products/getTableProduct",
        data: function (d) {
          // Thêm các filter vào request
          d.searchValue = $("#search_input").val();
          d.category = $("#filter_category").val();
          d.brand = $("#filter_brand").val();
          d.productType = $("#filter_productType").val();
          d.inventory = $("#filter_inventory").val();
          d.priceMin = $("#filter_price_min").val();
          d.priceMax = $("#filter_price_max").val();
          d.discount = $("#filter_discount").val();
        },
      },
      columns: [
        {
          data: "images",
          render: function (data) {
            return (
              `<img src="` +
              data[0] +
              `" alt=""height="65" width="65" onerror="this.src='` +
              err_src +
              `';" style="border-radius: 0.275rem;" >`
            );
          },
        },
        {
          data: "title",
          render: function (data) {
            const value = data.length > 39 ? data.slice(0, 40) + "..." : data;
            return '<div class= "my-3">' + value + "</div>";
          },
        },

        {
          data: "price",
          render: function (data) {
            return '<div class= "my-3">' + data + " VND</div>";
          },
        },
        {
          data: "inventory",
          render: function (data) {
            return '<div class= "my-3">' + data + "</div>";
          },
        },
        {
          data: null,
          render: function (row) {
            const currentRole = typeof currentUserRole !== "undefined" ? currentUserRole : "";
            const canEdit = currentRole === "super_admin" || currentRole === "admin";
            
            let buttons = [];
            if (canEdit) {
              buttons.push('<button type="button" class="btn btn-primary btn-sm mr-1 edit" data-id="' + row.id + '"><i class="fa fa-edit"></i></button>');
              buttons.push('<button type="button" class="btn btn-danger btn-sm delete" data-id="' + row.id + '"><i class="fa fa-trash-alt"></i></button>');
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
const loadCategory = function () {
  $.ajax({
    url: "/api/v1/categories",
    method: "GET",
    success: (data) => {
      $("#category").empty();
      $("#filter_category").empty().append('<option value="">Tất cả</option>');
      data.data.data.forEach((value) => {
        $("#category").append(
          "<option value=" + value.id + ">" + value.name + "</option>"
        );
        $("#filter_category").append(
          "<option value=" + value.id + ">" + value.name + "</option>"
        );
      });
    },
  });
};
const loadBrand = function () {
  $.ajax({
    url: "/api/v1/brands",
    method: "GET",
    success: (data) => {
      $("#brand").empty();
      $("#filter_brand").empty().append('<option value="">Tất cả</option>');
      data.data.data.forEach((value) => {
        $("#brand").append(
          "<option value=" + value.id + ">" + value.name + "</option>"
        );
        $("#filter_brand").append(
          "<option value=" + value.id + ">" + value.name + "</option>"
        );
      });
    },
  });
};
function reloadData() {
  $("#sample_data").DataTable().ajax.reload();
}
// Format số với dấu phẩy
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Parse số từ string có dấu phẩy/chấm
function parseNumber(str) {
  return parseInt(str.toString().replace(/\./g, "").replace(/,/g, "")) || 0;
}

// Format giá tiền khi nhập
$(document).on("input", "#price", function () {
  const value = $(this).val();
  const numericValue = parseNumber(value);
  if (numericValue > 0) {
    $(this).val(formatNumber(numericValue));
  }
});

// Format giá tiền khi blur (mất focus)
$(document).on("blur", "#price", function () {
  const value = $(this).val();
  const numericValue = parseNumber(value);
  if (numericValue > 0) {
    $(this).val(formatNumber(numericValue));
  } else if (value && value.trim() !== "") {
    $(this).val("");
  }
});

// Xử lý filter và search
function applyFilters() {
  if (dataTable) {
    dataTable.ajax.reload();
  }
}

// Event listeners cho các filter
$(document).ready(async function () {
  $("select").select2({
    theme: "bootstrap-5",
  });
  loadData();
  loadCategory();
  loadBrand();
  $(".navbar-nav li").removeClass("active");
  $(".navbar-nav li")[3].className = "nav-item active";
  
  // Tìm kiếm với debounce
  let searchTimeout;
  $("#search_input").on("keyup", function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      applyFilters();
    }, 500);
  });
  
  // Filter change events
  $("#filter_category, #filter_brand, #filter_productType, #filter_inventory, #filter_discount").on("change", function () {
    applyFilters();
  });
  
  $("#filter_price_min, #filter_price_max").on("keyup", function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      applyFilters();
    }, 500);
  });
  
  // Reset filters
  $("#reset_filters").on("click", function () {
    $("#search_input").val("");
    $("#filter_category").val("").trigger("change");
    $("#filter_brand").val("").trigger("change");
    $("#filter_productType").val("").trigger("change");
    $("#filter_inventory").val("").trigger("change");
    $("#filter_price_min").val("");
    $("#filter_price_max").val("");
    $("#filter_discount").val("").trigger("change");
    applyFilters();
  });
});
$("#add_data").click(function () {
  files = [];
  $("#dynamic_modal_title").text("Add Product");
  $("#sample_form")[0].reset();
  $("#category").val(null).trigger("change");
  $("#brand").val(null).trigger("change");
  $("#tags").val("");
  $("#productType").val("in-stock").trigger("change");
  $("#inventory").val(0);
  $("#price").val("");
  $("#discountPercent").val("");
  $("#height").val("");
  $("#width").val("");
  $("#depth").val("");
  $("#material").val("");
  $("#releaseDate").val("");
  $("#tags").val("");
  $("#action").val("Add");
  $("#id").val("");

  $("#action_button").text("Add");
  $(".img-show").empty();
  $(".mb-2").show();

  $("#action_modal").modal("show");
});
$(document).on("click", ".edit", function () {
  files = [];
  $("#sample_form")[0].reset();
  const id = $(this).data("id");

  $("#dynamic_modal_title").text("Edit Product");

  $("#action").val("Edit");

  $("#action_button").text("Edit");

  $("#action_modal").modal("show");
  $(".mb-2").hide();
  $(".img-show").empty();
  $(".edit-show").show();

  $.ajax({
    url: `/api/v1/products/${id}`,
    method: "GET",
    success: function (data) {
      const product = data.data.data;
      $("#id").val(id);
      $("#title").val(product.title);
      $("#category").val(product.category?.id).trigger("change");
      $("#brand").val(product.brand?.id).trigger("change");
      $("#tags").val(Array.isArray(product.tags) ? product.tags.join(", ") : (product.tags || ""));
      $("#productType").val(product.productType || "in-stock").trigger("change");
      $("#inventory").val(product.inventory || 0);
      $("#price").val(product.price ? formatNumber(product.price) : "");
      $("#discountPercent").val(
        product.price && product.promotion
          ? Math.round(((product.price - product.promotion) / product.price) * 100)
          : ""
      );
      $("#height").val(product.height);
      $("#width").val(product.width);
      $("#depth").val(product.depth);
      $("#material").val(product.material);
      $("#releaseDate").val(product.releaseDate);
      $("#tags").val(Array.isArray(product.tags) ? product.tags.join(", ") : (product.tags || ""));

      // Initialize TinyMCE if not already initialized
      if (typeof tinymce !== "undefined") {
        if (!tinymce.get("description")) {
          tinymce.init({
            selector: "#description",
            height: 300,
            menubar: false,
            plugins: ["advlist", "autolink", "lists", "link", "image", "charmap", "preview", "anchor"],
            toolbar: "undo redo | formatselect | bold italic | alignleft aligncenter alignright",
            license_key: "gpl",
            branding: false,
            promotion: false
          });
        }
        // Set content after initializing
        setTimeout(() => {
          const editor = tinymce.get("description");
          if (editor) {
            editor.setContent(product.description || "");
          }
        }, 100);
      }
    },
  });
});
$(document).on("click", ".delete", function () {
  const id = $(this).data("id");

  if (confirm("Are you sure you want to delete this data?")) {
    try {
      $.ajax({
        url: `/api/v1/products/${id}`,
        method: "delete",
        success: function (data) {
          showAlert("success", `Delete Product ${id} Successfully`);
          reloadData();
        },
      });
    } catch (error) {
      return showAlert("error", error.responseJSON.message);
    }
  }
});
