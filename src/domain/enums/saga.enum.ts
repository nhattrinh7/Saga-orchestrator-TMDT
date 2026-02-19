export const SagaType = {
  STARTED: 'STARTED',            // saga vừa được tạo, chưa bắt đầu step nào
  PROCESSING: 'PROCESSING',      // đang thực thi các step
  COMPLETED: 'COMPLETED',        // tất cả step thành công, luồng hoàn thành
  COMPENSATING: 'COMPENSATING',  // có lỗi tại 1 step, đang chạy compensation
  COMPENSATED: 'COMPENSATED',    // chạy compensation xong
} as const
export type SagaType = (typeof SagaType)[keyof typeof SagaType]


