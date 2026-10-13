-- DropIndex
DROP INDEX "Job_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "Job_status_createdAt_id_idx" ON "Job"("status", "createdAt", "id");
