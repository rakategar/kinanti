-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "userPhone" TEXT NOT NULL,
    "lastIntent" TEXT,
    "slots" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NlpLog" (
    "id" TEXT NOT NULL,
    "userPhone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "predicted" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "entities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NlpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_userPhone_key" ON "ConversationState"("userPhone");
