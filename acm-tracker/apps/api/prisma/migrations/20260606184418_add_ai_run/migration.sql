-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "agent" TEXT,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRun_timeEntryId_idx" ON "AiRun"("timeEntryId");

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
