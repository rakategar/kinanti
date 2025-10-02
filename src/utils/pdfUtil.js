// src/utils/pdfUtil.js
// Konversi kumpulan gambar (base64) → PDF Buffer
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

/**
 * images: array of { mimetype, data (base64 string) }
 * return: Buffer (PDF)
 */
async function imagesToPdf(images = []) {
  if (!images.length) throw new Error("Tidak ada gambar untuk dibuat PDF");

  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    const buffer = Buffer.from(img.data, "base64");
    // Resize/normalize pakai sharp → pastikan format jpg/png
    const sharped = await sharp(buffer).jpeg().toBuffer();

    const pdfImg = await pdfDoc.embedJpg(sharped);
    const page = pdfDoc.addPage([pdfImg.width, pdfImg.height]);
    page.drawImage(pdfImg, {
      x: 0,
      y: 0,
      width: pdfImg.width,
      height: pdfImg.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { imagesToPdf };
