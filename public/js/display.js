// TinyMCE initialization moved to individual pages (news.ejs) where it's needed
// to avoid conflicts with conditional loading

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function () {
  // scroll to top
  // Get the button
  const myButton = $(".scroll-to-top");
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    myButton.css("display", "block");
  } else {
    myButton.css("display", "none");
  }
};
$(".scroll-to-top").on("click", function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#logout").click(function () {
  $("#logoutModal").modal("show");
})
function logout() {
  $.ajax({
    url: "/api/v1/users/logout",
    method: "POST",  // ✅ Must be POST (protected endpoint)
    success: (data) => {
      // Clear session/cookies immediately
      document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // Redirect to login
      window.location = "/login";
    },
    error: (error) => {
      console.error("Logout error:", error);
      // Even if API fails, clear cookies and redirect
      document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      window.location = "/login";
    }
  });
}
