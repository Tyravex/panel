-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INSTALL', 'BACKUP', 'RESTART', 'REINSTALL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "serverId" INTEGER,
    "queueJobId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_queueJobId_key" ON "Job"("queueJobId");

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_serverId_createdAt_idx" ON "Job"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
