import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { SagaDefinition } from '~/domain/contracts/saga-definition.interface'
import { SAGATYPE } from '~/common/constants/saga.constant'

/**
 * ORDER_SAGA_DEFINITION - Khai báo toàn bộ flow đặt hàng.
 *
 * Nhìn vào file này là hiểu ngay flow đặt hàng:
 *
 * Phase 1 (Song song):
 *   VALIDATE_ITEMS ─┐
 *                    ├── chờ cả 2 xong mới tiến tiếp
 *   GET_ADDRESS ─────┘
 *
 * Phase 2 (Tuần tự):
 *   VALIDATE_VOUCHERS (skip nếu không có voucher)
 *   → CALCULATE_AND_VERIFY_PRICE (chạy local, tính giá tại orchestrator)
 *   → RESERVE_INVENTORY
 *   → CREATE_PAYMENT (skip nếu không phải QRCODE)
 *   → CREATE_ORDERS
 *   → CONFIRM_VOUCHERS (skip nếu không có voucher)
 *   → REMOVE_CART_ITEMS
 *
 * Compensation (rollback khi fail):
 *   RESERVE_INVENTORY → release-inventory
 *   CREATE_ORDERS → cancel-orders
 *   CREATE_PAYMENT → cancel-payment
 *   VALIDATE_VOUCHERS → cancel-vouchers
 *   CONFIRM_VOUCHERS → cancel-vouchers
 */
export const ORDER_SAGA_DEFINITION: SagaDefinition = {
  sagaType: SAGATYPE.ORDER_SAGA,

  phases: [
    // ========== Phase 1: Song song — validate items + lấy địa chỉ ==========
    {
      type: 'PARALLEL',
      steps: [
        {
          name: SagaStepName.VALIDATE_ITEMS,
          service: 'catalog',
          event: 'saga.validate-items',
        },
        {
          name: SagaStepName.GET_ADDRESS,
          service: 'user',
          event: 'saga.get-address',
        },
      ],
    },

    // ========== Phase 2: Tuần tự — validate vouchers → tính giá → reserve → tạo đơn ==========
    {
      type: 'SEQUENTIAL',
      steps: [
        {
          name: SagaStepName.VALIDATE_VOUCHERS,
          service: 'voucher',
          event: 'saga.validate-vouchers',
          // Skip nếu không có voucher nào
          skipWhen: (sagaData) => {
            const hasShopVouchers = sagaData.shopVouchers && Object.keys(sagaData.shopVouchers).length > 0
            return !hasShopVouchers && !sagaData.szoneVoucherId
          },
        },
        {
          name: SagaStepName.CALCULATE_AND_VERIFY_PRICE,
          isLocal: true, // Tính giá ngay tại orchestrator, không emit event
        },
        {
          name: SagaStepName.RESERVE_INVENTORY,
          service: 'inventory',
          event: 'saga.reserve-inventory',
        },
        {
          name: SagaStepName.CREATE_PAYMENT,
          service: 'payment',
          event: 'saga.create-payment',
          // Chỉ tạo payment khi thanh toán bằng QRCODE
          skipWhen: (sagaData) => sagaData.paymentMethod !== 'QRCODE',
        },
        {
          name: SagaStepName.CREATE_ORDERS,
          service: 'order',
          event: 'saga.create-orders',
          /**
           * WALLET/QRCODE: Dừng saga sau khi tạo đơn, chờ thanh toán.
           * - WALLET: chờ user xác nhận passcode → ConfirmWalletPaymentHandler trigger
           * - QRCODE: chờ webhook từ payment gateway → PaymentWebhookConsumer trigger
           * Engine sẽ KHÔNG advance tới CONFIRM_VOUCHERS/REMOVE_CART_ITEMS.
           * Các steps đó sẽ được handlePostPaymentSuccess() fire-and-forget khi thanh toán xong.
           *
           * COD: Không halt, tiếp tục confirm vouchers + remove cart ngay.
           */
          // thực hiện xong step CREATE_ORDERS này mới check haltAfter, nên WALLET và QROCODE vẫn chạy step CREATE_ORDERS này.
          haltAfter: (sagaData) => sagaData.paymentMethod !== 'COD',
        },
        {
          name: SagaStepName.CONFIRM_VOUCHERS,
          service: 'voucher',
          event: 'saga.confirm-vouchers',
          // Chỉ skip nếu không có voucher. Điều kiện COD không cần vì haltAfter ở trên
          // đã bảo vệ: WALLET/QRCODE sẽ không bao giờ tới step này qua main flow.
          skipWhen: (sagaData) => {
            const hasShopVouchers = sagaData.shopVouchers && Object.keys(sagaData.shopVouchers).length > 0
            return !hasShopVouchers && !sagaData.szoneVoucherId
          },
        },
        {
          name: SagaStepName.REMOVE_CART_ITEMS,
          service: 'user',
          event: 'saga.remove-cart-items',
          // Không cần skipWhen COD nữa vì haltAfter ở CREATE_ORDERS đã bảo vệ.
          // Step này chỉ chạy với COD (qua main flow).
          // WALLET/QRCODE: remove cart items được xử lý bởi handlePostPaymentSuccess().
        },
      ],
    },
  ],

  // ========== Compensation — khai báo cách rollback cho từng step ==========
  // ko có thứ tự gì ở đây, key nào value đấy là được
  // thứ tự compensation phụ thuộc vào thứ tự của completedSteps lấy từ DB theo thứ tự hoàn thành cơ
  compensation: {
    [SagaStepName.RESERVE_INVENTORY]: {
      event: 'saga.release-inventory',
      service: 'inventory',
    },
    [SagaStepName.CREATE_ORDERS]: {
      event: 'saga.cancel-orders',
      service: 'order',
    },
    [SagaStepName.CREATE_PAYMENT]: {
      event: 'saga.cancel-payment',
      service: 'payment',
    },
    [SagaStepName.VALIDATE_VOUCHERS]: {
      event: 'saga.cancel-vouchers',
      service: 'voucher',
    },
    [SagaStepName.CONFIRM_VOUCHERS]: {
      event: 'saga.cancel-vouchers',
      service: 'voucher',
    },
  },
}
