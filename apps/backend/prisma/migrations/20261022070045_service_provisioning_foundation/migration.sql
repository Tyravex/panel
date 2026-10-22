-- CreateEnum
CREATE TYPE "ServiceInstallStatus" AS ENUM ('DRAFT', 'PENDING_INSTALL', 'INSTALLING', 'INSTALLED', 'FAILED');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "cpuPercent" INTEGER,
ADD COLUMN     "diskMb" INTEGER,
ADD COLUMN     "installStatus" "ServiceInstallStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "memoryMb" INTEGER,
ADD COLUMN     "nodeId" TEXT;

-- CreateTable
CREATE TABLE "ServiceMember" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceMember_userId_idx" ON "ServiceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMember_serviceId_userId_key" ON "ServiceMember"("serviceId", "userId");

-- CreateIndex
CREATE INDEX "Service_nodeId_idx" ON "Service"("nodeId");

-- CreateIndex
CREATE INDEX "Service_installStatus_idx" ON "Service"("installStatus");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMember" ADD CONSTRAINT "ServiceMember_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMember" ADD CONSTRAINT "ServiceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
