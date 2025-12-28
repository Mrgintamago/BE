const express = require("express");
const reviewController = require("./../controllers/reviewController");
const authController = require("./../controllers/authController");

const router = express.Router({ mergeParams: true });


router
  .route("/")
  .get(reviewController.getAllReviews)
  .post(
    reviewController.createReviewGuestOrUser
  );
router.route("/getTableReview").get(
  authController.protect,
  authController.restrictTo("super_admin", "admin"),
  reviewController.getTableReview
);
router
  .route("/:id")
  .get(reviewController.getReview)
  .patch(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    reviewController.updateReview
  )
  .delete(
    authController.protect,
    authController.restrictTo("super_admin", "admin"),
    reviewController.deleteReview
  );

module.exports = router;
