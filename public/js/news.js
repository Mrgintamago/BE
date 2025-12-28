let selectedImages = [];
let currentImages = [];

// Hàm lấy cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

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
        url: "api/v1/news/getTableNews",
        dataSrc: function(json) {
          console.log("=== DataTables Response ===");
          console.log("Full response:", json);
          console.log("Data array:", json.data);
          console.log("Data count:", json.data?.length || 0);
          console.log("recordsTotal:", json.recordsTotal);
          console.log("recordsFiltered:", json.recordsFiltered);
          
          if (json.data && json.data.length > 0) {
            console.log("First item:", json.data[0]);
            console.log("First item keys:", Object.keys(json.data[0]));
          }
          
          // DataTables expects the data array directly
          return json.data || [];
        },
        error: function(xhr, error, thrown) {
          console.error("=== DataTables Ajax Error ===");
          console.error("Error:", error);
          console.error("Thrown:", thrown);
          console.error("Status:", xhr.status);
          console.error("Response:", xhr.responseText);
          
          if (xhr.status === 401) {
            showAlert("error", "Bạn cần đăng nhập để xem danh sách bài viết!");
          } else if (xhr.status === 403) {
            showAlert("error", "Bạn không có quyền truy cập!");
          } else if (xhr.status === 404) {
            showAlert("error", "Không tìm thấy API endpoint!");
          } else {
            showAlert("error", "Có lỗi xảy ra khi tải dữ liệu: " + (xhr.responseJSON?.message || error));
          }
        }
      },
      columns: [
        {
          data: "title",
          render: function (data, type, row) {
            const title = data || row.content?.substring(0, 50) + "...";
            return '<div class="my-3">' + (title.length > 50 ? title.substring(0, 50) + "..." : title) + "</div>";
          },
        },
        {
          data: "author",
          render: function (data) {
            return '<div class="my-3">' + (data?.name || "N/A") + "</div>";
          },
        },
        {
          data: "status",
          render: function (data) {
            const badgeClass = data === "published" ? "status-published" : "status-draft";
            const text = data === "published" ? "Công khai" : "Bản nháp";
            return '<div class="my-3"><span class="status-badge ' + badgeClass + '">' + text + "</span></div>";
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
          data: "views",
          render: function (data) {
            return '<div class="my-3">' + (data || 0) + "</div>";
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
  if ($.fn.DataTable.isDataTable("#sample_data")) {
    $("#sample_data").DataTable().ajax.reload(null, false);
    console.log("DataTable reloaded");
  } else {
    console.error("DataTable not initialized, calling loadData()");
    loadData();
  }
}

// Xử lý chọn ảnh cho form đăng bài chính
$(document).on("change", "#images", function (e) {
  const files = Array.from(e.target.files);
  console.log("Files selected:", files.length);
  files.forEach((file) => {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        selectedImages.push({
          file: file,
          preview: e.target.result,
        });
        updateImagePreview();
      };
      reader.readAsDataURL(file);
    } else {
      console.warn("File type not supported:", file.type);
    }
  });
  // Reset input để có thể chọn lại cùng file
  $(this).val("");
});

function updateImagePreview() {
  const container = $("#image-preview-container");
  container.empty();
  
  selectedImages.forEach((img, index) => {
    const imageDiv = $(`
      <div class="news-image-preview">
        <img src="${img.preview}" alt="Preview">
        <button type="button" class="remove-image" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `);
    container.append(imageDiv);
  });
}

// Xóa ảnh preview
$(document).on("click", ".remove-image", function () {
  const index = $(this).data("index");
  selectedImages.splice(index, 1);
  updateImagePreview();
});

// Đăng bài
$("#publish-btn").on("click", function () {
  // Lấy nội dung từ TinyMCE
  let content = "";
  let plainText = "";
  
  if (typeof tinymce !== "undefined" && tinymce.get("news-content")) {
    content = tinymce.get("news-content").getContent().trim();
    plainText = tinymce.get("news-content").getContent({ format: "text" }).trim();
  } else {
    content = $("#news-content").val().trim();
    plainText = content;
  }
  
  const title = $("#title").val().trim();
  const status = $("#status").val();

  if (!content || !plainText) {
    showAlert("error", "Vui lòng nhập nội dung bài viết!");
    return;
  }

  const formData = new FormData();
  formData.append("title", title || plainText.substring(0, 50));
  formData.append("content", content);
  formData.append("status", status);
  // Không gửi mảng rỗng JSON, chỉ gửi file thực tế
  // formData.append("images", JSON.stringify([]));

  console.log("Selected images count:", selectedImages.length);
  selectedImages.forEach((img, index) => {
    console.log(`Appending image ${index + 1}:`, img.file.name, img.file.type);
    formData.append("images", img.file);
  });

  // Disable button để tránh double submit
  $("#publish-btn").prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i> Đang đăng...');

  $.ajax({
    url: "/api/v1/news",
    method: "POST",
    data: formData,
    processData: false,
    contentType: false,
    xhrFields: {
      withCredentials: true // Gửi cookie để authenticate
    },
    beforeSend: function(xhr) {
      // Lấy token từ cookie nếu có
      const token = getCookie("jwt");
      if (token) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      }
    },
    success: function (data) {
      showAlert("success", "Đăng bài thành công!");
      $("#title").val("");
      // Clear TinyMCE content
      if (typeof tinymce !== "undefined" && tinymce.get("news-content")) {
        tinymce.get("news-content").setContent("");
      } else {
        $("#news-content").val("");
      }
      selectedImages = [];
      updateImagePreview();
      
      // Reload DataTable sau khi đăng bài
      setTimeout(function() {
        reloadData();
      }, 300);
      
      $("#publish-btn").prop("disabled", false).html('<i class="fas fa-paper-plane"></i> Đăng bài');
    },
    error: function (error) {
      console.error("Error:", error);
      const errorMsg = error.responseJSON?.message || error.responseJSON?.error?.message || "Có lỗi xảy ra khi đăng bài!";
      showAlert("error", errorMsg);
      $("#publish-btn").prop("disabled", false).html('<i class="fas fa-paper-plane"></i> Đăng bài');
    },
  });
});

// Chỉnh sửa bài viết
$(document).on("click", ".edit", function () {
  const id = $(this).data("id");
  selectedImages = [];
  currentImages = [];

  $("#dynamic_modal_title").text("Chỉnh sửa bài viết");
  $("#action").val("Edit");
  $("#id").val(id);
  $("#action_button").text("Cập nhật");

  // Khởi tạo TinyMCE cho edit_content nếu chưa có
  if (typeof tinymce !== "undefined" && !tinymce.get("edit_content")) {
            tinymce.init({
              selector: "#edit_content",
              license_key: "gpl",
              height: 300,
              max_height: 300,
              resize: false,
              menubar: false,
              statusbar: false,
              branding: false,
              promotion: false,
              plugins: "lists link emoticons",
              toolbar: "bold italic underline | bullist numlist | link emoticons",
              content_style: "body { font-family: Arial, sans-serif; font-size: 14px; }",
              language: "vi"
            });
  }

    $.ajax({
      url: `/api/v1/news/${id}`,
      method: "GET",
      xhrFields: {
        withCredentials: true // Gửi cookie để authenticate
      },
      beforeSend: function(xhr) {
        const token = getCookie("jwt");
        if (token) {
          xhr.setRequestHeader("Authorization", "Bearer " + token);
        }
      },
      success: function (data) {
      const news = data.data.data;
      $("#edit_title").val(news.title || "");
      
      // Set content vào TinyMCE nếu có, nếu không thì vào textarea
      if (typeof tinymce !== "undefined" && tinymce.get("edit_content")) {
        tinymce.get("edit_content").setContent(news.content || "");
      } else {
        $("#edit_content").val(news.content || "");
      }
      
      $("#edit_status").val(news.status || "draft");
      
      currentImages = news.images || [];
      updateCurrentImages();
      
      // Hiển thị/ẩn nút "Đăng bài" dựa trên status
      if (news.status === "draft") {
        $("#publish_article_btn").show();
      } else {
        $("#publish_article_btn").hide();
      }
      
      // Lưu news ID để dùng cho nút đăng bài
      $("#publish_article_btn").data("news-id", id);
    },
  });

  $("#action_modal").modal("show");
  
  // Ẩn nút đăng bài mặc định, sẽ hiển thị sau khi load dữ liệu nếu là draft
  $("#publish_article_btn").hide();
});

function updateCurrentImages() {
  const container = $("#current-images");
  container.empty();
  
  currentImages.forEach((imgUrl, index) => {
    const imageDiv = $(`
      <div class="position-relative" style="width: 150px;">
        <img src="${imgUrl}" class="img-thumbnail" style="width: 100%; height: 150px; object-fit: cover;">
        <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 remove-current-image" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `);
    container.append(imageDiv);
  });
}

// Xóa ảnh hiện tại
$(document).on("click", ".remove-current-image", function () {
  const index = $(this).data("index");
  currentImages.splice(index, 1);
  updateCurrentImages();
});

// Preview ảnh mới được chọn trong modal edit
$(document).on("change", "#edit_images", function (e) {
  const files = Array.from(e.target.files);
  const container = $("#new-images-preview");
  container.empty();
  
  files.forEach((file, index) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const imageDiv = $(`
          <div class="position-relative" style="width: 100px;">
            <img src="${event.target.result}" class="img-thumbnail" style="width: 100%; height: 100px; object-fit: cover;">
          </div>
        `);
        container.append(imageDiv);
      };
      reader.readAsDataURL(file);
    }
  });
});

// Submit form chỉnh sửa
$("#sample_form").on("submit", function (e) {
  e.preventDefault();
  
  // Lấy nội dung từ TinyMCE nếu có
  let editContent = "";
  if (typeof tinymce !== "undefined" && tinymce.get("edit_content")) {
    editContent = tinymce.get("edit_content").getContent();
  } else {
    editContent = $("#edit_content").val();
  }
  
  const formData = new FormData();
  formData.append("action", $("#action").val());
  formData.append("title", $("#edit_title").val());
  formData.append("content", editContent);
  formData.append("status", $("#edit_status").val());
  formData.append("images", JSON.stringify(currentImages));

  const files = $("#edit_images")[0].files;
  Array.from(files).forEach((file) => {
    formData.append("images", file);
  });

  const id = $("#id").val();
  
  $("#action_button").prop("disabled", true).text("Đang cập nhật...");

  $.ajax({
    url: `/api/v1/news/${id}`,
    method: "PATCH",
    data: formData,
    processData: false,
    contentType: false,
    xhrFields: {
      withCredentials: true // Gửi cookie để authenticate
    },
    beforeSend: function(xhr) {
      const token = getCookie("jwt");
      if (token) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      }
    },
    success: function (data) {
      console.log("Update success:", data);
      showAlert("success", "Cập nhật bài viết thành công!");
      $("#action_modal").modal("hide");
      setTimeout(function() {
        reloadData();
      }, 300);
      $("#action_button").prop("disabled", false).text("Cập nhật");
    },
    error: function (error) {
      console.error("Error:", error);
      const errorMsg = error.responseJSON?.message || error.responseJSON?.error?.message || "Có lỗi xảy ra!";
      showAlert("error", errorMsg);
      $("#action_button").prop("disabled", false).text("Cập nhật");
    },
  });
});

// Đăng bài viết từ bản nháp
$(document).on("click", "#publish_article_btn", function () {
  const id = $(this).data("news-id");
  
  if (!id) {
    showAlert("error", "Không tìm thấy ID bài viết!");
    return;
  }
  
  // Lấy nội dung từ TinyMCE nếu có
  let editContent = "";
  if (typeof tinymce !== "undefined" && tinymce.get("edit_content")) {
    editContent = tinymce.get("edit_content").getContent();
  } else {
    editContent = $("#edit_content").val();
  }
  
  if (!editContent || editContent.trim() === "") {
    showAlert("error", "Vui lòng nhập nội dung bài viết!");
    return;
  }
  
  const formData = new FormData();
  formData.append("title", $("#edit_title").val());
  formData.append("content", editContent);
  formData.append("status", "published"); // Chuyển sang published
  formData.append("images", JSON.stringify(currentImages));
  
  // Disable button
  $("#publish_article_btn").prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i> Đang đăng...');
  
  $.ajax({
    url: `/api/v1/news/${id}`,
    method: "PATCH",
    data: formData,
    processData: false,
    contentType: false,
    xhrFields: {
      withCredentials: true
    },
    beforeSend: function(xhr) {
      const token = getCookie("jwt");
      if (token) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      }
    },
    success: function (data) {
      console.log("Publish success:", data);
      showAlert("success", "Đăng bài thành công!");
      $("#action_modal").modal("hide");
      setTimeout(function() {
        reloadData();
      }, 300);
      $("#publish_article_btn").prop("disabled", false).html('<i class="fas fa-paper-plane"></i> Đăng bài');
    },
    error: function (error) {
      console.error("Publish error:", error);
      const errorMsg = error.responseJSON?.message || error.responseJSON?.error?.message || "Có lỗi xảy ra khi đăng bài!";
      showAlert("error", errorMsg);
      $("#publish_article_btn").prop("disabled", false).html('<i class="fas fa-paper-plane"></i> Đăng bài');
    },
  });
});

// Xóa bài viết
$(document).on("click", ".delete", function () {
  const id = $(this).data("id");

  if (confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) {
    $.ajax({
      url: `/api/v1/news/${id}`,
      method: "DELETE",
      xhrFields: {
        withCredentials: true // Gửi cookie để authenticate
      },
      beforeSend: function(xhr) {
        const token = getCookie("jwt");
        if (token) {
          xhr.setRequestHeader("Authorization", "Bearer " + token);
        }
      },
      success: function (data) {
        console.log("Delete success:", data);
        showAlert("success", "Xóa bài viết thành công!");
        setTimeout(function() {
          reloadData();
        }, 300);
      },
      error: function (error) {
        showAlert("error", error.responseJSON?.message || "Có lỗi xảy ra!");
      },
    });
  }
});

$(document).ready(function () {
  loadData();
  $(".navbar-nav li").removeClass("active");
  // Tìm index của News trong sidebar (sau Reviews)
  const navItems = $(".navbar-nav li");
  navItems.each(function(index) {
    if ($(this).find('a[href="/news"]').length > 0) {
      $(this).addClass("active");
      return false;
    }
  });
});

