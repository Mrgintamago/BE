let files = [],
  dragArea = document.querySelector(".drag-area"),
  input = document.querySelector(".drag-area input"),
  button = document.querySelector(".img-cover button"),
  select = document.querySelector(".drag-area .select"),
  container = document.querySelector(".img-show");

/** CLICK LISTENER */
select.addEventListener("click", () => input.click());

/* INPUT CHANGE EVENT */
input.addEventListener("change", () => {
  let file = input.files;

  // if user select no image
  if (file.length == 0) return;

  for (let i = 0; i < file.length; i++) {
    if (file[i].type.split("/")[0] != "image") continue;
    if (!files.some((e) => e.name == file[i].name)) files.push(file[i]);
  }

  showImages();
});

/** SHOW IMAGES */
function showImages() {
  container.innerHTML = files.reduce((prev, curr, index) => {
    return `${prev}
		    <div class="image">
			    <span onclick="delImage(${index})">&times;</span>
			    <img src="${URL.createObjectURL(curr)}" />
			</div>`;
  }, "");
}

/* DELETE IMAGE */
function delImage(index) {
  files.splice(index, 1);
  showImages();
}

/* DRAG & DROP */
dragArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dragArea.classList.add("dragover");
});

/* DRAG LEAVE */
dragArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragArea.classList.remove("dragover");
});

/* DROP EVENT */
dragArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dragArea.classList.remove("dragover");

  let file = e.dataTransfer.files;
  for (let i = 0; i < file.length; i++) {
    /** Check selected file is image */
    if (file[i].type.split("/")[0] != "image") continue;

    if (!files.some((e) => e.name == file[i].name)) files.push(file[i]);
  }
  showImages();
});

const addProduct = async (data) => {
  try {
    await $.ajax({
      url: "/api/v1/products",
      method: "post",
      data,
      processData: false,
      contentType: false,
      beforeSend: function () {
        $("#action_button").attr("disabled", "disabled");
      },
      success: (data) => {
        $("#action_button").attr("disabled", false);
        $("#sample_form")[0].reset();
        $("#action_modal").modal("hide");
        reloadData();
        showAlert("success", "Add Product successfully!");
      },
    });
  } catch (error) {
    $("#action_button").attr("disabled", false);
    return showAlert("error", error.responseJSON.message);
  }
};
const editProduct = async (data) => {
  try {
    const id = $("#id").val();
    await $.ajax({
      url: `/api/v1/products/${id}`,
      method: "patch",
      data,
      processData: false,
      contentType: false,
      beforeSend: function () {
        $("#action_button").attr("disabled", "disabled");
      },
      success: (data) => {
        $("#action_button").attr("disabled", false);
        $("#action_modal").modal("hide");
        $("#sample_form")[0].reset();
        reloadData();
        showAlert("success", "Edit Product successfully!");
      },
    });
  } catch (error) {
    $("#action_button").attr("disabled", false);
    return showAlert("error", error.responseJSON.message);
  }
};
$("#sample_form").on("submit", async (e) => {
  e.preventDefault();
  const dt = new DataTransfer();
  files.forEach((file) => {
    dt.items.add(file);
  });
  const newFileList = dt.files;
  $("input:file")[0].files = newFileList;
  
  // Safely trigger TinyMCE save if editor is initialized
  if (typeof tinyMCE !== "undefined" && tinyMCE.activeEditor) {
    tinyMCE.triggerSave();
  }
  
  let form_data = new FormData($("form")[0]);

  // Parse giá từ string có định dạng
  function parsePrice(str) {
    return parseInt(str.toString().replace(/\./g, "").replace(/,/g, "")) || 0;
  }

  // Tính toán giá giảm theo %
  const priceInput = $("#price").val() || "0";
  const price = parsePrice(priceInput);
  const discount = Number($("#discountPercent").val() || 0);
  
  // Validate discount không vượt quá 100%
  const validDiscount = Math.min(100, Math.max(0, discount));
  
  const promo =
    price > 0 && validDiscount > 0
      ? Math.max(0, Math.round(price * (1 - validDiscount / 100)))
      : price;

  form_data.set("price", price);
  form_data.set("promotion", promo);

  // Chuẩn hóa tags (phân loại hàng)
  const tags = ($("#tags").val() || "").trim();
  form_data.set("tags", tags);

  const action = $("#action").val();
  if (action === "Add") {
    addProduct(form_data);
  } else {
    editProduct(form_data);
  }
});
