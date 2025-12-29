const express = require("express");
const Order = require("../models/orderModel");
const paymentController = require("../controllers/paymentController");
const logger = require("../utils/logger");

const router = express.Router();

// Debug endpoint - view order details
router.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({
      _id: order._id,
      status: order.status,
      payments: order.payments,
      email: order.email,
      totalPrice: order.totalPrice,
      invoicePayment: order.invoicePayment,
      cart: order.cart.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint - simulate webhook
router.post("/webhook/test", async (req, res) => {
  try {
    const testPayload = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: req.body.orderCode || 12345678,
        amount: 40000,
        reference: "TEST123",
      },
      signature: "test-signature", // Will fail signature check but shows webhook flow
    };

    logger.log("🔵 [DEBUG] Test webhook payload:", JSON.stringify(testPayload, null, 2));
    
    // Call webhook handler
    // Note: This will fail on signature verification, but shows the flow
    res.json({
      message: "Test payload created",
      payload: testPayload,
      note: "Signature verification will fail - this is just for testing the flow",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
