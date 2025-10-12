-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'AUDIO', 'PDF', 'OTHER');

-- CreateTable
CREATE TABLE "Assessment" (
    "id" SERIAL NOT NULL,
    "guruId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "description" TEXT,
    "kkm" INTEGER NOT NULL DEFAULT 75,
    "timeOpen" TIMESTAMP(3),
    "timeClose" TIMESTAMP(3),
    "durationMin" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "showScoreImmediately" BOOLEAN NOT NULL DEFAULT true,
    "showKeyAfterClose" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "number" INTEGER,
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "answerKeyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT,
    "isCorrect" BOOLEAN,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMedia" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "hash" TEXT,
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionMedia" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "hash" TEXT,
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "siswaId" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptItem" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "questionId" INTEGER,
    "snapshot" JSONB NOT NULL,
    "selectedLabel" TEXT,
    "isCorrect" BOOLEAN,

    CONSTRAINT "AttemptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_code_key" ON "Assessment"("code");

-- CreateIndex
CREATE INDEX "Assessment_guruId_className_status_idx" ON "Assessment"("guruId", "className", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Question_answerKeyId_key" ON "Question"("answerKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_questionId_label_key" ON "Option"("questionId", "label");

-- CreateIndex
CREATE INDEX "Attempt_assessmentId_siswaId_status_idx" ON "Attempt"("assessmentId", "siswaId", "status");

-- CreateIndex
CREATE INDEX "AttemptItem_attemptId_sortOrder_idx" ON "AttemptItem"("attemptId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_answerKeyId_fkey" FOREIGN KEY ("answerKeyId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionMedia" ADD CONSTRAINT "QuestionMedia_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionMedia" ADD CONSTRAINT "OptionMedia_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptItem" ADD CONSTRAINT "AttemptItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
