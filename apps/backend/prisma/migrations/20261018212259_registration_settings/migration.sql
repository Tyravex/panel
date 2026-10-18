-- CreateTable
CREATE TABLE "PanelSetting" (
    "key" TEXT NOT NULL,
    "booleanValue" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelSetting_pkey" PRIMARY KEY ("key")
);
