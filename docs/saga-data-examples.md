# Order Saga - Ví dụ cấu trúc dữ liệu

## 1. Trường `data` của bản ghi Saga

Được tạo 1 lần duy nhất ở `PlaceOrderHandler` và **không bao giờ thay đổi** sau đó.
Cấu trúc chính là `PlaceOrderRequestDto`.

```json
{
  "itemsByShop": {
    "shop_id_1": [
      { "productId": "p1", "productVariantId": "pv1", "quantity": 2 },
      { "productId": "p2", "productVariantId": "pv2", "quantity": 1 }
    ],
    "shop_id_2": [
      { "productId": "p3", "productVariantId": "pv3", "quantity": 3 }
    ]
  },
  "shopVouchers": { "shop_id_1": "voucher_id_1" },
  "szoneVoucherId": "szone_voucher_id",
  "expectedFinalPrice": 350000,
  "addressId": "addr_123",
  "paymentMethod": "WALLET"
}
```

- `paymentMethod` có thể là: `"COD"` | `"WALLET"` | `"QRCODE"`
- `shopVouchers` và `szoneVoucherId` là optional (có thể không có)

---

## 2. Trường `result` của SagaStep — khác nhau với mỗi step

Engine lưu nguyên cả object result vào DB, rồi truyền vào `previousResults` (Map).
Các step handler cụ thể sẽ tự biết cần lấy trường gì từ result của step trước.

---

### VALIDATE_ITEMS → Catalog Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "variants": [
    {
      "id": "pv1",
      "price": 100000,
      "productName": "Áo thun",
      "sku": "SKU-001",
      "image": "https://...",
      "categoryId": "cat1"
    },
    {
      "id": "pv2",
      "price": 50000,
      "productName": "Quần jean",
      "sku": "SKU-002",
      "image": "https://...",
      "categoryId": "cat2"
    }
  ]
}
```

**Ai dùng result này:**
- `ValidateVouchersStepHandler` → lấy `variants` để tính `orderValue`
- `CalculateVerifyPriceStepHandler` → lấy `variants` để tính giá
- `CreateOrdersStepHandler` → lấy `variants` để lấy tên, giá, sku, ảnh sản phẩm

---

### GET_ADDRESS → User Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "address": {
    "detail": "123 Nguyễn Văn A",
    "ward": "Phường 1",
    "province": "TP.HCM",
    "recipientName": "Nguyễn Văn B",
    "recipientPhoneNumber": "0901234567"
  }
}
```

**Ai dùng result này:**
- `CreateOrdersStepHandler` → lấy `address` để build `shippingAddress`, `receiverName`, `receiverPhoneNumber`

---

### VALIDATE_VOUCHERS → Voucher Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "shopVoucherResults": [
    { "shopId": "shop_id_1", "discount": 20000 }
  ],
  "szoneVoucherResult": {
    "discount": 10000
  }
}
```

**Ai dùng result này:**
- `CalculateVerifyPriceStepHandler` → lấy `shopVoucherResults` và `szoneVoucherResult` để tính discount
- `CreateOrdersStepHandler` → lấy để truyền vào `buildOrdersData`

---

### CALCULATE_AND_VERIFY_PRICE → Local step, tính ngay tại Orchestrator

```json
{
  "totalSubtotal": 250000,
  "totalShippingFee": 30000,
  "totalShopVoucherDiscount": 20000,
  "szoneVoucherDiscount": 10000,
  "finalPrice": 250000,
  "shopBreakdowns": [
    {
      "shopId": "shop_id_1",
      "subtotal": 200000,
      "shippingFee": 15000,
      "shopVoucherDiscount": 20000,
      "szoneVoucherDiscount": 7000,
      "finalPrice": 188000
    },
    {
      "shopId": "shop_id_2",
      "subtotal": 50000,
      "shippingFee": 15000,
      "shopVoucherDiscount": 0,
      "szoneVoucherDiscount": 3000,
      "finalPrice": 62000
    }
  ]
}
```

**Ai dùng result này:**
- `CreatePaymentStepHandler` → lấy `finalPrice` để tạo thanh toán
- `CreateOrdersStepHandler` → lấy `shopBreakdowns` để build dữ liệu từng đơn hàng
- `ConfirmWalletPaymentHandler` → lấy `finalPrice` làm `amount` để trừ ví

---

### RESERVE_INVENTORY → Inventory Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "reservationIds": ["res_1", "res_2"]
}
```

**Ai dùng result này:**
- `ReserveInventoryStepHandler.buildCompensationPayload` → lấy `reservationIds` để release khi compensate

---

### CREATE_PAYMENT → Payment Service trả về (chỉ chạy khi QRCODE)

```json
{
  "sagaId": "...",
  "success": true,
  "paymentId": "pay_123"
}
```

**Ai dùng result này:**
- `CreateOrdersStepHandler` → lấy `paymentId` để gắn vào đơn hàng
- `CreatePaymentStepHandler.buildCompensationPayload` → lấy `paymentId` để cancel payment khi compensate

---

### CREATE_ORDERS → Order Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "orderIds": ["order_1", "order_2"]
}
```

**Ai dùng result này:**
- `SagaEngine.handlePostPaymentSuccess` → lấy `orderIds` để update status đơn hàng
- `SagaEngine.advanceToNextStep` (khi hết phases) → lấy `orderIds` để notify FE
- `CreateOrdersStepHandler.buildCompensationPayload` → lấy `orderIds` để cancel orders khi compensate

---

### PROCESS_WALLET_PAYMENT → User Service trả về

```json
{
  "sagaId": "...",
  "success": true,
  "walletTransactionId": "wtx_123"
}
```

**Ai dùng result này:**
- `SagaEngine.handleStepResult` → nhận biết wallet payment thành công → gọi `handlePostPaymentSuccess`

---

## 3. Luồng thanh toán theo paymentMethod

### COD (Thanh toán khi nhận hàng)
```
VALIDATE_ITEMS + GET_ADDRESS (song song)
→ VALIDATE_VOUCHERS (nếu có)
→ CALCULATE_AND_VERIFY_PRICE (local)
→ RESERVE_INVENTORY
→ (skip CREATE_PAYMENT)
→ CREATE_ORDERS
→ CONFIRM_VOUCHERS (nếu có)
→ REMOVE_CART_ITEMS
→ COMPLETED
```

### WALLET (Thanh toán bằng ví)
```
VALIDATE_ITEMS + GET_ADDRESS (song song)
→ VALIDATE_VOUCHERS (nếu có)
→ CALCULATE_AND_VERIFY_PRICE (local)
→ RESERVE_INVENTORY
→ (skip CREATE_PAYMENT)
→ CREATE_ORDERS
→ HALT (chờ user nhập passcode)
→ ConfirmWalletPaymentHandler tạo step PROCESS_WALLET_PAYMENT + emit tới User Service
→ User Service verify passcode + trừ ví → trả result
→ SagaStepResultConsumer → handleStepResult → handlePostPaymentSuccess
→ (fire-and-forget: update orders, confirm vouchers, remove cart)
→ COMPLETED
```

### QRCODE (Chuyển khoản ngân hàng)
```
VALIDATE_ITEMS + GET_ADDRESS (song song)
→ VALIDATE_VOUCHERS (nếu có)
→ CALCULATE_AND_VERIFY_PRICE (local)
→ RESERVE_INVENTORY
→ CREATE_PAYMENT (tạo QR code)
→ CREATE_ORDERS
→ HALT (chờ user chuyển khoản)
→ Ngân hàng gọi Webhook → PaymentWebhookConsumer → handlePostPaymentSuccess
→ (fire-and-forget: update orders, confirm vouchers, remove cart)
→ COMPLETED
```
