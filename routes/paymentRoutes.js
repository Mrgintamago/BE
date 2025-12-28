const express = require("express");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

// PayOS routes
router.post("/payos", paymentController.createPayOSPayment);
router.get("/payos-return", paymentController.payosReturn);
router.post("/payos-callback", paymentController.payosCallback);

// Payment details
router.get("/:orderId", paymentController.getPaymentDetails);

module.exports = router;
