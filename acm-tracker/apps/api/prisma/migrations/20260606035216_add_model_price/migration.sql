-- CreateTable
CREATE TABLE "ModelPrice" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPer1M" DOUBLE PRECISION NOT NULL,
    "outputPer1M" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelPrice_provider_model_key" ON "ModelPrice"("provider", "model");
