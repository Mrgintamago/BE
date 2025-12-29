const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const axios = require("axios");
const crypto = require("crypto");
const logger = require("../utils/logger");

/**
 * PayOS Payment Controller
 * Tích hợp PayOS - sandbox/production
 */

// PayOS Credentials
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";
const PAYOS_API_URL = "https://api-merchant.payos.vn";

logger.log(`🔵 PayOS initialized`);

// Tạo QR code thanh toán PayOS
exports.createPayOSPayment = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;
  
  logger.log("🔵 createPayOSPayment - orderId:", orderId);

  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
    logger.error("❌ PayOS credentials missing");
    return next(new AppError("PayOS credentials không được cấu hình", 500));
  }

  // Kiểm tra order tồn tại
  const order = await Order.findById(orderId);
  if (!order) {
    logger.error("❌ Order not found:", orderId);
    return next(new AppError("Đơn hàng không tồn tại", 404));
  }
  
  logger.log("✅ Order found:", order._id);

  const amount = Math.round(order.totalPrice);
  const orderCode = parseInt(orderId.toString().slice(-8)) || Date.now();
  
  // Description must be max 25 characters (or 9 for non-linked bank accounts)
  const description = `Don hang ${orderCode}`.substring(0, 25);

  // Get frontend URL - intelligent detection for different environments
  const getFrontendUrl = () => {
    // Lấy từ request header (Origin/Referer) nếu khả dụng
    const origin = req.get('origin') || req.get('referer');
    if (origin) {
      try {
        return new URL(origin).origin;
      } catch (e) {
        // Nếu parse fails, tiếp tục
      }
    }
    // Fallback: từ environment variables
    return process.env.FRONTEND_URL || "http://localhost:5173";
  };

  const frontendUrl = getFrontendUrl();
  const backendUrl = process.env.BACKEND_URL || "https://tqn.onrender.com";
  const returnUrl = `${frontendUrl}/payment-result?orderId=${orderId}&orderCode=${orderCode}`;
  const cancelUrl = `${frontendUrl}/checkout?orderId=${orderId}&cancel=true`;

  try {
    logger.log("🔵 Creating PayOS payment request...");
    logger.log("🔵 Frontend URL detected:", frontendUrl);
    logger.log("🔵 Backend URL detected:", backendUrl);
    
    const paymentData = {
      orderCode: orderCode,
      amount: amount,
      description: description,
      buyerName: order.receiver || "Khách hàng",
      buyerEmail: order.email || "customer@email.com",
      buyerPhone: order.phone || "0000000000",
      buyerAddress: order.address || "Địa chỉ",
      cancelUrl: cancelUrl,
      returnUrl: returnUrl,
    };

    // Tạo signature theo PayOS format
    const signatureData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
    const signature = crypto
      .createHmac("sha256", PAYOS_CHECKSUM_KEY)
      .update(signatureData)
      .digest("hex");

    const payload = {
      ...paymentData,
      signature: signature,
    };

    logger.log("🔵 Signature:", signature);
    logger.log("🔵 Calling PayOS API...");

    const response = await axios.post(
      `${PAYOS_API_URL}/v2/payment-requests`,
      payload,
      {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    logger.log("✅ PayOS payment link created successfully");
    logger.log("🔵 Full response:", JSON.stringify(response.data, null, 2));

    // Handle error code 231: payment request already exists
    if (response.data.code === "231") {
      logger.warn("⚠️ [231] Payment request already exists, retrieving existing payment link...");
      
      try {
        // Call PayOS API to get existing payment request
        const getPaymentResponse = await axios.get(
          `${PAYOS_API_URL}/v2/payment-requests/${orderCode}`,
          {
            headers: {
              "x-client-id": PAYOS_CLIENT_ID,
              "x-api-key": PAYOS_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );
        
        logger.log("✅ Retrieved existing payment:", JSON.stringify(getPaymentResponse.data, null, 2));
        const existingPayment = getPaymentResponse.data.data;
        
        // If payment is CANCELLED or EXPIRED, cancel it and create new one
        if (existingPayment?.status === "CANCELLED" || existingPayment?.status === "EXPIRED") {
          logger.warn("⚠️ Existing payment is", existingPayment.status, "- creating new one...");
          
          // Try to cancel the old payment
          try {
            await axios.delete(
              `${PAYOS_API_URL}/v2/payment-requests/${orderCode}`,
              {
                headers: {
                  "x-client-id": PAYOS_CLIENT_ID,
                  "x-api-key": PAYOS_API_KEY,
                  "Content-Type": "application/json",
                },
              }
            );
            logger.log("✅ Cancelled old payment, creating new one...");
          } catch (cancelError) {
            logger.warn("⚠️ Failed to cancel old payment, trying to create with new code");
          }
          
          // Create with new order code (add timestamp to make it unique)
          const newOrderCode = parseInt(orderId.toString().slice(-8)) + Date.now() % 10000 || Date.now();
          logger.log("🔵 Retrying with new orderCode:", newOrderCode);
          
          const retryPaymentData = {
            orderCode: newOrderCode,
            amount: amount,
            description: description,
            buyerName: order.receiver || "Khách hàng",
            buyerEmail: order.email || "customer@email.com",
            buyerPhone: order.phone || "0000000000",
            buyerAddress: order.address || "Địa chỉ",
            cancelUrl: cancelUrl,
            returnUrl: returnUrl,
          };
          
          const retrySignatureData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${newOrderCode}&returnUrl=${returnUrl}`;
          const retrySignature = crypto
            .createHmac("sha256", PAYOS_CHECKSUM_KEY)
            .update(retrySignatureData)
            .digest("hex");
          
          const retryResponse = await axios.post(
            `${PAYOS_API_URL}/v2/payment-requests`,
            { ...retryPaymentData, signature: retrySignature },
            {
              headers: {
                "x-client-id": PAYOS_CLIENT_ID,
                "x-api-key": PAYOS_API_KEY,
                "Content-Type": "application/json",
              },
            }
          );
          
          const newCheckoutUrl = retryResponse.data.data?.checkoutUrl;
          if (newCheckoutUrl) {
            logger.log("✅ New payment created with URL:", newCheckoutUrl);
            return res.status(200).json({
              status: "success",
              message: "PayOS Payment Link (new attempt)",
              data: {
                checkoutUrl: newCheckoutUrl,
                qrCode: retryResponse.data.data?.qrCode || null,
              },
            });
          }
        }
        
        // If payment is PENDING, build checkout URL from paymentLinkId
        if (existingPayment?.id) {
          const existingCheckoutUrl = `https://pay.payos.vn/web/${existingPayment.id}`;
          logger.log("✅ Using existing pending payment URL:", existingCheckoutUrl);
          return res.status(200).json({
            status: "success",
            message: "PayOS Payment Link (existing)",
            data: {
              checkoutUrl: existingCheckoutUrl,
              qrCode: null,
            },
          });
        }
      } catch (getError) {
        logger.warn("⚠️ Failed to retrieve existing payment:", getError.message);
      }
      
      // Fallback: return from order if available
      if (order.invoicePayment?.payosCheckoutUrl) {
        logger.log("✅ Using saved checkout URL from order:", order.invoicePayment.payosCheckoutUrl);
        return res.status(200).json({
          status: "success",
          message: "PayOS Payment Link (cached)",
          data: {
            checkoutUrl: order.invoicePayment.payosCheckoutUrl,
            qrCode: null,
          },
        });
      }
      
      return next(new AppError("Đơn hàng này đã có yêu cầu thanh toán. Vui lòng sử dụng link thanh toán trước.", 409));
    }

    const checkoutUrl = response.data.data?.checkoutUrl;
    const qrCode = response.data.data?.qrCode;

    if (!checkoutUrl) {
      logger.error("❌ No checkoutUrl in response");
      return next(new AppError("PayOS không trả về checkout URL", 500));
    }

    logger.log("✅ Checkout URL:", checkoutUrl);

    // Lưu PayOS transaction ID vào order
    const updatedOrder = await Order.findByIdAndUpdate(orderId, {
      invoicePayment: {
        payosOrderCode: orderCode,
        payosCheckoutUrl: checkoutUrl,
        createdAt: new Date(),
      },
    }, { new: true });

    logger.log("✅ Order updated:", updatedOrder._id);

    res.status(200).json({
      status: "success",
      message: "PayOS Payment Link",
      data: {
        checkoutUrl: checkoutUrl,
        qrCode: qrCode || null,
      },
    });
  } catch (error) {
    logger.error("❌ PayOS API Error:");
    logger.error("   Status:", error.response?.status);
    logger.error("   Data:", JSON.stringify(error.response?.data, null, 2));
    logger.error("   Message:", error.message);
    logger.error("   Full error:", error);
    return next(
      new AppError(
        `Lỗi PayOS: ${error.response?.data?.message || error.message}`,
        500
      )
    );
  }
});

// Xử lý PayOS webhook callback
exports.payosCallback = catchAsync(async (req, res, next) => {
  const { code, desc, success, data, signature } = req.body;
  
  logger.log("🔵 [WEBHOOK] PayOS callback received!");
  logger.log("🔵 [WEBHOOK] Body:", JSON.stringify(req.body, null, 2));
  logger.log("🔵 [WEBHOOK] Code:", code);
  logger.log("🔵 [WEBHOOK] Success:", success);
  logger.log("🔵 [WEBHOOK] Data:", JSON.stringify(data, null, 2));

  if (!data || !data.orderCode) {
    logger.error("❌ [WEBHOOK] Missing orderCode in data");
    return res.status(400).json({
      code: "error",
      desc: "Thiếu order code",
      success: false,
    });
  }

  // Verify signature (HMAC-SHA256)
  try {
    const signatureData = JSON.stringify(data);
    const expectedSignature = crypto
      .createHmac("sha256", PAYOS_CHECKSUM_KEY)
      .update(signatureData)
      .digest("hex");
    
    if (signature !== expectedSignature) {
      logger.error("❌ [WEBHOOK] Signature mismatch!");
      logger.error("   Expected:", expectedSignature);
      logger.error("   Got:", signature);
      return res.status(403).json({
        code: "error",
        desc: "Signature không hợp lệ",
        success: false,
      });
    }
    logger.log("✅ [WEBHOOK] Signature verified");
  } catch (signErr) {
    logger.error("❌ [WEBHOOK] Signature verification error:", signErr.message);
    return res.status(400).json({
      code: "error",
      desc: "Lỗi xác thực chữ ký",
      success: false,
    });
  }

  // Tìm order theo payosOrderCode
  const order = await Order.findOne({
    "invoicePayment.payosOrderCode": data.orderCode,
  });

  logger.log("🔵 [WEBHOOK] Found order:", order ? order._id : "NOT FOUND");

  if (!order) {
    logger.error("❌ [WEBHOOK] Order not found with code:", data.orderCode);
    return res.status(404).json({
      code: "error",
      desc: "Đơn hàng không tồn tại",
      success: false,
    });
  }

  // Cập nhật trạng thái đơn hàng dựa trên thanh toán
  if (success === true && code === "00") {
    logger.log("✅ [WEBHOOK] Payment SUCCESSFUL, updating order...");
    const updatedOrder = await Order.findByIdAndUpdate(order._id, {
      payments: "payos",
      status: "Processed",
      invoicePayment: {
        ...order.invoicePayment,
        payosTransactionNo: data.reference,
        payDate: new Date(),
        amount: data.amount || order.totalPrice,
        status: "SUCCESS",
      },
    }, { new: true });

    logger.log("✅ [WEBHOOK] Order updated successfully, returning response");
    // Email sẽ được gửi sau khi admin chấp nhận đơn hàng, không gửi ngay khi thanh toán
    
    // Deduct inventory when payment is confirmed
    try {
      if (updatedOrder.cart && Array.isArray(updatedOrder.cart)) {
        for (const item of updatedOrder.cart) {
          if (item.product && item.quantity) {
            // item.product could be either Object with _id or string ID
            const productId = (typeof item.product === 'object') 
              ? (item.product._id || item.product.toString())
              : item.product;
            
            if (!productId) continue;
            
            await Product.findByIdAndUpdate(
              productId,
              { $inc: { quantity: -item.quantity } },
              { new: true }
            );
            logger.log(`✅ [INVENTORY] Deducted ${item.quantity} units from product ${productId}`);
          }
        }
      }
    } catch (invErr) {
      logger.error("❌ [INVENTORY] Error deducting inventory:", invErr.message);
      // Continue - don't fail the payment confirmation even if inventory deduction fails
    }
    
    res.status(200).json({
      code: "00",
      desc: "Thanh toán PayOS thành công",
      success: true,
      data: {
        orderId: order._id,
      },
    });
  } else {
    logger.log("❌ [WEBHOOK] Payment FAILED/CANCELLED with code:", code);
    // FAILED, CANCELLED
    await Order.findByIdAndUpdate(order._id, {
      status: "Cancelled",
      invoicePayment: {
        ...order.invoicePayment,
        status: code,
      },
    });

    res.status(200).json({
      code: code,
      desc: desc,
      success: false,
      data: {
        orderId: order._id,
      },
    });
  }
});

// Xử lý PayOS return (user click link từ PayOS)
exports.payosReturn = catchAsync(async (req, res, next) => {
  const { orderId, orderCode } = req.query;

  // Tìm order theo ID hoặc payosOrderCode
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      status: "error",
      message: "Đơn hàng không tồn tại",
    });
  }

  // Lấy trạng thái thực từ PayOS API
  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY) {
    return res.status(500).json({
      status: "error",
      message: "PayOS credentials không được cấu hình",
    });
  }

  try {
    const payosOrderCode =
      order.invoicePayment?.payosOrderCode || orderCode;
    
    if (!payosOrderCode) {
      return res.status(400).json({
        status: "error",
        message: "Không tìm thấy mã đơn hàng PayOS",
      });
    }

    // Gọi PayOS API để lấy trạng thái
    const response = await axios.get(
      `${PAYOS_API_URL}/qr-code/get?orderCode=${payosOrderCode}`,
      {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
        },
      }
    );

    const { status, amountPaid, transactionNo } = response.data.data || {};

    // Cập nhật order nếu thanh toán thành công
    if (status === "PAID") {
      await Order.findByIdAndUpdate(orderId, {
        payments: "payos",
        status: "Processed",
        invoicePayment: {
          ...order.invoicePayment,
          payosTransactionNo: transactionNo,
          payDate: new Date(),
          amount: amountPaid || order.totalPrice,
          status: "SUCCESS",
        },
      });
    }

    res.status(200).json({
      status: "success",
      message: "Thanh toán PayOS",
      data: {
        orderId: orderId,
        paymentStatus: status,
        amount: amountPaid || order.totalPrice,
      },
    });
  } catch (error) {
    logger.error("PayOS API Error:", error.response?.data || error.message);
    // Vẫn cho phép return khi có lỗi, chỉ log
    res.status(200).json({
      status: "success",
      message: "Thanh toán PayOS",
      data: {
        orderId: orderId,
        amount: order.totalPrice,
      },
    });
  }
});

// Lấy chi tiết thanh toán PayOS
exports.getPaymentDetails = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new AppError("Đơn hàng không tồn tại", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      orderId: order._id,
      totalPrice: order.totalPrice,
      paymentMethod: order.payments,
      status: order.status,
      invoicePayment: order.invoicePayment,
    },
  });
});
