-- CreateTable
CREATE TABLE "TimerSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimerSession_memberId_key" ON "TimerSession"("memberId");

-- CreateIndex
CREATE INDEX "TimerSession_taskId_idx" ON "TimerSession"("taskId");

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
