-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "dockerImage" TEXT;

-- CreateIndex
CREATE INDEX "Job_serviceId_createdAt_idx" ON "Job"("serviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
