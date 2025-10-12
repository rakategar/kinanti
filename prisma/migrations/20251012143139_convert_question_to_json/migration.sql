/*
  Warnings:

  - You are about to drop the column `maxAttempts` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `showKeyAfterClose` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `showScoreImmediately` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `shuffleOptions` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `shuffleQuestions` on the `Assessment` table. All the data in the column will be lost.
  - The `status` column on the `Assessment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `answerKeyId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the `Attempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AttemptItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Option` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OptionMedia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionMedia` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `data` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "AttemptItem" DROP CONSTRAINT "AttemptItem_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "Option" DROP CONSTRAINT "Option_questionId_fkey";

-- DropForeignKey
ALTER TABLE "OptionMedia" DROP CONSTRAINT "OptionMedia_optionId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_answerKeyId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionMedia" DROP CONSTRAINT "QuestionMedia_questionId_fkey";

-- DropIndex
DROP INDEX "Assessment_guruId_className_status_idx";

-- DropIndex
DROP INDEX "Question_answerKeyId_key";

-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "maxAttempts",
DROP COLUMN "showKeyAfterClose",
DROP COLUMN "showScoreImmediately",
DROP COLUMN "shuffleOptions",
DROP COLUMN "shuffleQuestions",
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "answerKeyId",
DROP COLUMN "explanation",
DROP COLUMN "number",
DROP COLUMN "text",
DROP COLUMN "updatedAt",
DROP COLUMN "weight",
ADD COLUMN     "data" JSONB NOT NULL;

-- DropTable
DROP TABLE "Attempt";

-- DropTable
DROP TABLE "AttemptItem";

-- DropTable
DROP TABLE "Option";

-- DropTable
DROP TABLE "OptionMedia";

-- DropTable
DROP TABLE "QuestionMedia";
