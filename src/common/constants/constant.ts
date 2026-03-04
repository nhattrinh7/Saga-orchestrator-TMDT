export const SHIPPING_FEE_PER_SHOP = 500

/** Thời gian tối đa chờ thanh toán (WALLET/QRCODE): 15 phút */
export const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000

/** Tên queue BullMQ chứa các job */
export const PAYMENT_QUEUE_NAME = 'payment-queue'

/** Tên job xử lý timeout thanh toán */
export const PAYMENT_TIMEOUT_JOB_NAME = 'payment-timeout-job'
