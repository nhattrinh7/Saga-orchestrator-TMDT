-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('STARTED', 'PROCESSING', 'COMPLETED', 'COMPENSATING', 'COMPENSATED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED');

-- CreateTable
CREATE TABLE "sagas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "saga_type" VARCHAR(50) NOT NULL DEFAULT 'ORDER_SAGA',
    "status" "SagaStatus" NOT NULL DEFAULT 'STARTED',
    "current_step" VARCHAR(100),
    "data" JSONB NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "compensated_at" TIMESTAMPTZ,

    CONSTRAINT "sagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_steps" (
    "id" UUID NOT NULL,
    "saga_id" UUID NOT NULL,
    "step_name" VARCHAR(100) NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "saga_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saga_steps_saga_id_step_name_idx" ON "saga_steps"("saga_id", "step_name");

-- CreateIndex
CREATE INDEX "saga_steps_saga_id_status_created_at_idx" ON "saga_steps"("saga_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "saga_steps" ADD CONSTRAINT "saga_steps_saga_id_fkey" FOREIGN KEY ("saga_id") REFERENCES "sagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
