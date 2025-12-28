const express = require("express");
const commentController = require("./../controllers/commentController");
const authController = require("./../controllers/authController");

const router = express.Router({ mergeParams: true });


router
  .route("/")
  .get(commentController.getAllComments)
  .post(
    authController.protect,
    authController.restrictTo("user", "employee", "admin", "super_admin", "manager", "sales_staff"),
    commentController.setProductUserIds,
    commentController.createComment
  );
router.route("/getTableComment").get(
  authController.protect,
  authController.restrictTo("super_admin", "admin"),
  commentController.getTableComment
);
router
  .route("/setLike/:id")
  .patch(
    authController.protect,
    authController.restrictTo("user", "employee", "admin", "super_admin", "manager", "sales_staff"),
    commentController.likeComment
  );
router
  .route("/:id")
  .get(commentController.getComment)
  .patch(
    authController.protect,
    authController.restrictTo("user", "employee", "admin", "super_admin", "manager", "sales_staff"),
    commentController.isOwner,
    commentController.updateComment
  )
  .delete(
    authController.protect,
    authController.restrictTo("user", "employee", "admin", "super_admin", "manager", "sales_staff"),
    commentController.isOwner,
    commentController.deleteComment
  );

module.exports = router;
