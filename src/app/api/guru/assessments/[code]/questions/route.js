export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req, ctx) {
  try {
    const { code } = await ctx.params;
    const decoded = decodeURIComponent(code);
    const { text, options, answerKeyLabel, imageUrl } = await req.json();

    if (!text || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { ok: false, message: "Data soal tidak valid." },
        { status: 400 }
      );
    }

    const assessment = await prisma.assessment.findUnique({
      where: { code: decoded },
    });
    if (!assessment)
      return NextResponse.json(
        { ok: false, message: "Assessment tidak ditemukan." },
        { status: 404 }
      );

    const created = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: { assessmentId: assessment.id, text, weight: 1 },
      });
      const createdOpts = [];
      for (const o of options) {
        const row = await tx.option.create({
          data: { questionId: q.id, label: o.label, text: o.text || null },
        });
        createdOpts.push(row);
      }
      if (imageUrl) {
        await tx.questionMedia.create({
          data: { questionId: q.id, type: "IMAGE", url: imageUrl },
        });
      }
      for (const o of options) {
        if (o.imageUrl) {
          const opt = createdOpts.find((x) => x.label === o.label);
          if (opt)
            await tx.optionMedia.create({
              data: { optionId: opt.id, type: "IMAGE", url: o.imageUrl },
            });
        }
      }
      if (answerKeyLabel) {
        const keyOpt = createdOpts.find((x) => x.label === answerKeyLabel);
        if (keyOpt)
          await tx.question.update({
            where: { id: q.id },
            data: { answerKeyId: keyOpt.id },
          });
      }
      return q;
    });

    const qs = await prisma.question.findMany({
      where: { assessmentId: assessment.id },
      orderBy: { id: "asc" },
      include: { options: { include: { media: true } }, media: true },
    });

    const questions = qs.map((q) => ({
      id: q.id,
      text: q.text,
      answerKeyLabel: q.answerKeyId
        ? q.options.find((o) => o.id === q.answerKeyId)?.label || null
        : null,
      media: q.media,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
        media: o.media,
      })),
      imageUrl: q.media?.[0]?.url ?? null,
    }));

    return NextResponse.json({
      ok: true,
      data: { createdId: created.id, questions },
    });
  } catch (e) {
    console.error("[questions POST] error:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal menyimpan soal." },
      { status: 500 }
    );
  }
}
