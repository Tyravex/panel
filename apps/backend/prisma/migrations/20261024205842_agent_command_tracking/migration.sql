-- CreateEnum
CREATE TYPE "AgentCommandStatus" AS ENUM ('PREPARED', 'SENT', 'ACCEPTED', 'COMPLETED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "AgentCommand" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "AgentCommandStatus" NOT NULL DEFAULT 'PREPARED',
    "sessionId" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "jobCommandKey" TEXT NOT NULL,

    CONSTRAINT "AgentCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentCommand_jobCommandKey_key" ON "AgentCommand"("jobCommandKey");

-- CreateIndex
CREATE INDEX "AgentCommand_jobId_status_idx" ON "AgentCommand"("jobId", "status");

-- CreateIndex
CREATE INDEX "AgentCommand_nodeId_status_idx" ON "AgentCommand"("nodeId", "status");

-- CreateIndex
CREATE INDEX "AgentCommand_status_preparedAt_idx" ON "AgentCommand"("status", "preparedAt");

-- AddForeignKey
ALTER TABLE "AgentCommand" ADD CONSTRAINT "AgentCommand_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
