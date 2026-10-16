-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('OFFLINE', 'ONLINE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'OFFLINE',
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Node_tokenHash_key" ON "Node"("tokenHash");

-- CreateIndex
CREATE INDEX "Node_status_idx" ON "Node"("status");
