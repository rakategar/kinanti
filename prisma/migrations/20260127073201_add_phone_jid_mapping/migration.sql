-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "kunciJawaban" TEXT;

-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "evaluation" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "score" INTEGER;

-- CreateTable
CREATE TABLE "PhoneJidMapping" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneJidMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneJidMapping_phone_key" ON "PhoneJidMapping"("phone");
