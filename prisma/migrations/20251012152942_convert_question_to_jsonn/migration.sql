-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "maxAttempts" INTEGER,
ADD COLUMN     "showKeyAfterClose" BOOLEAN,
ADD COLUMN     "showScoreImmediately" BOOLEAN,
ADD COLUMN     "shuffleOptions" BOOLEAN,
ADD COLUMN     "shuffleQuestions" BOOLEAN,
ALTER COLUMN "kkm" DROP NOT NULL,
ALTER COLUMN "kkm" DROP DEFAULT,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
