// src/utils/hotsPdf.js
// Generator PDF soal HOTS (client-side) memakai jsPDF.
// Menghasilkan DUA file terpisah: PDF Soal dan PDF Kunci Jawaban.
//
// Fitur penting (perbaikan "hasil mentah"):
//  - Embed font DejaVu (Unicode penuh) sehingga simbol matematika (√ ≤ ≥ ≠ × ÷ π θ Σ ∫ →),
//    superscript/subscript, dan huruf Yunani TER-RENDER benar (font bawaan jsPDF hanya Latin-1).
//  - Blok kode (```lang ... ```) dirender monospace di dalam kotak, indentasi & baris dijaga.
//  - Inline code (`kode`), bold (**tebal**), dan LaTeX ($...$, \frac, \sqrt, ^, _) diterjemahkan.
import { jsPDF } from "jspdf";

/* =========================================================================
 * 1. FONT UNICODE (DejaVu) — di-fetch dari /public/fonts lalu didaftarkan.
 * =======================================================================*/
const FONT_FILES = {
  sans: "/fonts/DejaVuSans.ttf",
  sansBold: "/fonts/DejaVuSans-Bold.ttf",
  mono: "/fonts/DejaVuSansMono.ttf",
};
let _fontCache = null;

function bufToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFonts() {
  if (_fontCache) return _fontCache;
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Gagal memuat font ${url} (HTTP ${res.status})`);
      return [key, bufToBase64(await res.arrayBuffer())];
    }),
  );
  _fontCache = Object.fromEntries(entries);
  return _fontCache;
}

function registerFonts(doc, fonts) {
  doc.addFileToVFS("DejaVuSans.ttf", fonts.sans);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.sansBold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
  doc.addFileToVFS("DejaVuSansMono.ttf", fonts.mono);
  doc.addFont("DejaVuSansMono.ttf", "DejaVuSansMono", "normal");
}

/* =========================================================================
 * 2. KONVERSI LaTeX / MATEMATIKA → teks Unicode (+ info superscript/subscript)
 * =======================================================================*/
const SUP = {
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", a: "ᵃ", b: "ᵇ",
  c: "ᶜ", d: "ᵈ", e: "ᵉ", x: "ˣ", y: "ʸ",
};
const SUB = {
  0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ",
  o: "ₒ", x: "ₓ", n: "ₙ", m: "ₘ", t: "ₜ",
};
const toSup = (s) => [...String(s)].map((c) => SUP[c] || c).join("");
const toSub = (s) => [...String(s)].map((c) => SUB[c] || c).join("");

// Simbol & huruf Yunani LaTeX → Unicode.
const SYM = {
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓", ast: "∗", star: "⋆",
  circ: "∘", bullet: "•", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠",
  ne: "≠", approx: "≈", equiv: "≡", sim: "∼", cong: "≅", propto: "∝",
  ll: "≪", gg: "≫", infty: "∞", partial: "∂", nabla: "∇", sum: "∑",
  prod: "∏", int: "∫", oint: "∮", rightarrow: "→", to: "→", gets: "←",
  leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", implies: "⇒",
  Leftarrow: "⇐", Leftrightarrow: "⇔", iff: "⇔", mapsto: "↦", uparrow: "↑",
  downarrow: "↓", forall: "∀", exists: "∃", nexists: "∄", neg: "¬",
  land: "∧", wedge: "∧", lor: "∨", vee: "∨", oplus: "⊕", otimes: "⊗",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃",
  supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅",
  varnothing: "∅", angle: "∠", perp: "⊥", parallel: "∥", triangle: "△",
  cdots: "⋯", ldots: "…", dots: "…", vdots: "⋮", ddots: "⋱", prime: "′",
  degree: "°", Re: "ℜ", Im: "ℑ", aleph: "ℵ", hbar: "ℏ", ell: "ℓ",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", langle: "⟨", rangle: "⟩",
  therefore: "∴", because: "∵", cdotp: "·", quad: " ", qquad: "  ",
  // Yunani kecil
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π", varpi: "ϖ",
  rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  // Yunani besar
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const TEXTCMD = new Set([
  "text", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "operatorname",
  "boldsymbol", "textbf", "textit", "textrm", "displaystyle",
]);

const needsParen = (x) => x.length > 1 && /[+\-*/=\s×·÷^_]/.test(x);
function fracText(a, b) {
  const A = needsParen(a) ? `(${a})` : a;
  const B = needsParen(b) ? `(${b})` : b;
  return `${A}/${B}`;
}

// Parser LaTeX satu-lintasan → daftar run {text, script:'n'|'sup'|'sub'}.
function convertMath(src) {
  const s = String(src);
  const runs = [];
  let buf = "";
  const flush = () => {
    if (buf) runs.push({ text: buf, script: "n" });
    buf = "";
  };
  const readGroup = (idx) => {
    if (s[idx] === "{") {
      let depth = 0, j = idx, out = "";
      for (; j < s.length; j++) {
        const ch = s[j];
        if (ch === "{") { depth++; if (depth === 1) continue; }
        else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
        out += ch;
      }
      return [out, j];
    }
    if (s[idx] === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(idx));
      if (m) return [s.slice(idx, idx + m[0].length), idx + m[0].length];
    }
    return [s[idx] ?? "", idx + 1];
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        const name = m[1];
        i += m[0].length;
        if (name === "frac" || name === "dfrac" || name === "tfrac") {
          while (s[i] === " ") i++;
          let [a, i1] = readGroup(i); i = i1;
          while (s[i] === " ") i++;
          let [b, i2] = readGroup(i); i = i2;
          buf += fracText(flatMath(a), flatMath(b));
        } else if (name === "sqrt") {
          let root = "";
          if (s[i] === "[") { const e = s.indexOf("]", i); root = s.slice(i + 1, e); i = e + 1; }
          while (s[i] === " ") i++;
          let [a, i1] = readGroup(i); i = i1;
          const inner = flatMath(a);
          buf += (root ? toSup(flatMath(root)) : "") + "√" + (needsParen(inner) ? `(${inner})` : inner);
        } else if (TEXTCMD.has(name)) {
          while (s[i] === " ") i++;
          let [a, i1] = readGroup(i); i = i1;
          buf += flatMath(a);
        } else if (name === "left" || name === "right") {
          // buang, delimiter setelahnya tetap terbaca
        } else if (SYM[name] !== undefined) {
          buf += SYM[name];
        }
        // makro tak dikenal: diabaikan
      } else {
        const nx = s[i + 1];
        if ("{}_^%#&$".includes(nx)) { buf += nx; i += 2; }
        else if (",;: !".includes(nx)) { buf += " "; i += 2; }
        else i++;
      }
    } else if (c === "^" || c === "_") {
      i++;
      while (s[i] === " ") i++;
      const [g, ni] = readGroup(i); i = ni;
      flush();
      runs.push({ text: flatMath(g), script: c === "^" ? "sup" : "sub" });
    } else if (c === "{" || c === "}" || c === "$") {
      i++;
    } else {
      buf += c;
      i++;
    }
  }
  flush();
  return runs.filter((r) => r.text !== "");
}

// Versi datar (nested di dalam frac/sqrt/script) → string Unicode tunggal.
function flatMath(src) {
  return convertMath(src)
    .map((r) => (r.script === "sup" ? toSup(r.text) : r.script === "sub" ? toSub(r.text) : r.text))
    .join("");
}

// Apakah sepotong teks kemungkinan mengandung LaTeX (untuk memutuskan konversi di prosa biasa).
const looksLikeLatex = (t) =>
  /\\[a-zA-Z]+|[\^_]\{|[\^_][0-9A-Za-z(]|\\frac|\\sqrt/.test(t);

/* =========================================================================
 * 3. PARSER INLINE (code / math / bold) → styled runs
 * =======================================================================*/
// run: { text, font:'sans'|'mono', weight:'normal'|'bold', script:'n'|'sup'|'sub' }
function parseInline(text, base = { font: "sans", weight: "normal" }) {
  const runs = [];
  let buf = "";
  const pushPlain = (t) => {
    if (!t) return;
    if (base.font !== "mono" && looksLikeLatex(t)) {
      for (const r of convertMath(t)) {
        runs.push({ text: r.text, font: "sans", weight: base.weight, script: r.script });
      }
    } else {
      runs.push({ text: t, font: base.font, weight: base.weight, script: "n" });
    }
  };
  const flush = () => { pushPlain(buf); buf = ""; };

  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        flush();
        runs.push({ text: text.slice(i + 1, end), font: "mono", weight: base.weight, script: "n" });
        i = end + 1;
        continue;
      }
    }
    if (two === "**" || two === "__") {
      const close = text.indexOf(two, i + 2);
      if (close > i) {
        flush();
        runs.push(...parseInline(text.slice(i + 2, close), { font: base.font, weight: "bold" }));
        i = close + 2;
        continue;
      }
    }
    if (text[i] === "$") {
      const end = text.indexOf("$", i + 1);
      if (end > i) {
        flush();
        for (const r of convertMath(text.slice(i + 1, end))) {
          runs.push({ text: r.text, font: "sans", weight: base.weight, script: r.script });
        }
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return runs;
}

// Pisahkan blok kode berpagar dari teks biasa.
function parseBlocks(raw) {
  const text = String(raw ?? "");
  const blocks = [];
  const fence = /```([a-zA-Z0-9+#._-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = fence.exec(text))) {
    if (m.index > last) {
      const pre = text.slice(last, m.index).replace(/\n+$/, "");
      if (pre.trim()) blocks.push({ type: "para", text: pre });
    }
    blocks.push({ type: "code", lang: (m[1] || "").trim(), code: m[2].replace(/\n$/, "") });
    last = fence.lastIndex;
  }
  const tail = text.slice(last).replace(/^\n+/, "");
  if (tail.trim() || blocks.length === 0) blocks.push({ type: "para", text: tail });
  return blocks;
}

/* =========================================================================
 * 4. META & LABEL
 * =======================================================================*/
const BLOOM_LABEL = { C4: "C4 – Analisis", C5: "C5 – Evaluasi", C6: "C6 – Kreasi" };
const OPSI_KEYS = ["A", "B", "C", "D", "E"];

function levelLabel(level) {
  const key = String(level || "").toUpperCase().slice(0, 2);
  return BLOOM_LABEL[key] || level || "-";
}
function sanitizeFilePart(s) {
  return (
    String(s || "soal").trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) ||
    "soal"
  );
}
function normalize(data, meta) {
  const soalList = Array.isArray(data?.soal) ? data.soal : [];
  return {
    soalList,
    isPg: (data?.jenisSoal || meta.jenisSoal) === "Pilihan Ganda",
    mataPelajaran: data?.mataPelajaran || meta.mataPelajaran || "-",
    judul: data?.judul || meta.judulSoal || "-",
    jenisSoal: data?.jenisSoal || meta.jenisSoal || "-",
    jumlahSoal: soalList.length || meta.jumlahSoal || 0,
  };
}

/* =========================================================================
 * 5. RENDERER (auto page-break, wrapping, styled runs, kode)
 * =======================================================================*/
function newRenderer(fonts) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  registerFonts(doc, fonts);
  doc.setFont("DejaVuSans", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 56;
  let y = 48;

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 48;
    }
  };

  const setRunFont = (run, size) => {
    if (run.font === "mono") doc.setFont("DejaVuSansMono", "normal");
    else doc.setFont("DejaVuSans", run.weight === "bold" ? "bold" : "normal");
    doc.setFontSize(size);
  };

  // Tulis deretan styled-run dengan word-wrap + superscript/subscript.
  const writeRuns = (runs, x, opts = {}) => {
    const { fontSize = 11, lineGap = 5 } = opts;
    const lineHeight = fontSize + lineGap;
    const maxX = pageWidth - marginX;
    const SCRIPT_SCALE = 0.72;

    // Pecah tiap run jadi atom kata + spasi agar bisa dibungkus.
    const atoms = [];
    for (const run of runs) {
      for (const part of run.text.split(/(\s+)/)) {
        if (part === "") continue;
        atoms.push({ text: part, run, isSpace: /^\s+$/.test(part) });
      }
    }

    ensureSpace(lineHeight);
    let curX = x;
    for (const atom of atoms) {
      const size = atom.run.script === "n" ? fontSize : fontSize * SCRIPT_SCALE;
      setRunFont(atom.run, size);
      const w = doc.getTextWidth(atom.text);
      if (atom.isSpace) {
        if (curX > x) curX += w;
        continue;
      }
      if (curX + w > maxX && curX > x) {
        y += lineHeight;
        ensureSpace(lineHeight);
        curX = x;
      }
      let dy = 0;
      if (atom.run.script === "sup") dy = -(fontSize * 0.34);
      else if (atom.run.script === "sub") dy = fontSize * 0.16;
      doc.text(atom.text, curX, y + dy);
      curX += w;
    }
    y += lineHeight;
  };

  // Teks kaya (inline): bold, inline-code, math. `text` bisa multi-baris (\n).
  const writeRich = (text, x, opts = {}) => {
    const lines = String(text ?? "").split("\n");
    const lh = (opts.fontSize || 11) + (opts.lineGap ?? 5);
    for (let raw of lines) {
      if (raw.trim() === "") { y += lh * 0.5; continue; }
      // Normalisasi bullet markdown "* " / "- " → "•  "
      const line = raw.replace(/^(\s*)[*\-]\s+/, "$1•  ");
      const runs = parseInline(line, { font: "sans", weight: opts.bold ? "bold" : "normal" });
      writeRuns(runs, x, opts);
    }
  };

  // Blok kode monospace di dalam kotak, indentasi & baris dipertahankan.
  const drawCodeBlock = (lang, code) => {
    const fontSize = 9.5, lineGap = 3.5, padX = 10;
    const lineHeight = fontSize + lineGap;
    const boxLeft = marginX, boxRight = pageWidth - marginX;
    const innerW = boxRight - boxLeft - padX * 2;

    doc.setFont("DejaVuSansMono", "normal");
    doc.setFontSize(fontSize);
    const visual = [];
    for (const ln of code.replace(/\t/g, "    ").split("\n")) {
      const wrapped = doc.splitTextToSize(ln === "" ? " " : ln, innerW);
      visual.push(...(wrapped.length ? wrapped : [""]));
    }

    y += 6;
    const band = (drawText, opt = {}) => {
      ensureSpace(lineHeight);
      doc.setFillColor(245, 246, 248);
      doc.rect(boxLeft, y - fontSize + 2, boxRight - boxLeft, lineHeight, "F");
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(2);
      doc.line(boxLeft, y - fontSize + 2, boxLeft, y + 2 + lineGap);
      doc.setLineWidth(0.2);
      if (drawText != null) {
        doc.setFont("DejaVuSansMono", "normal");
        doc.setFontSize(opt.size || fontSize);
        doc.setTextColor(...(opt.color || [30, 30, 40]));
        doc.text(drawText, opt.align === "right" ? boxRight - padX : boxLeft + padX, y, {
          align: opt.align || "left",
        });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(fontSize);
      }
      y += lineHeight;
    };

    // padding atas (+ label bahasa opsional)
    if (lang) band(lang.toLowerCase(), { size: 8, color: [120, 120, 140], align: "right" });
    else band(null);

    for (const ln of visual) band(ln);
    band(null); // padding bawah
    y += 8;
  };

  // Konten lengkap: blok kode + teks kaya.
  const writeContent = (text, x, opts = {}) => {
    for (const block of parseBlocks(text)) {
      if (block.type === "code") drawCodeBlock(block.lang, block.code);
      else writeRich(block.text, x, opts);
    }
  };

  const hr = (color = 220) => {
    ensureSpace(14);
    doc.setDrawColor(color);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;
  };
  const gap = (n) => { y += n; };

  return {
    doc, marginX, pageWidth,
    get y() { return y; },
    ensureSpace, writeRich, writeContent, hr, gap,
  };
}

function drawHeader(r, title, info) {
  const { doc, marginX, pageWidth } = r;
  const tanggal = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(14);
  doc.text("NAMA SEKOLAH", pageWidth / 2, r.y, { align: "center" });
  r.gap(20);
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, r.y, { align: "center" });
  r.gap(22);

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(11);
  const rows = [
    ["Mata Pelajaran", info.mataPelajaran],
    ["Judul", info.judul],
    ["Jenis Soal", info.jenisSoal],
    ["Jumlah Soal", `${info.jumlahSoal} soal`],
    ["Tanggal", tanggal],
  ];
  for (const [label, value] of rows) {
    r.ensureSpace(16);
    doc.text(String(label), marginX, r.y);
    doc.text(":", marginX + 90, r.y);
    doc.text(String(value), marginX + 100, r.y);
    r.gap(16);
  }
  r.gap(4);
  r.hr(150);
  r.gap(4);
}

/* =========================================================================
 * 6. EKSPOR — PDF Soal & PDF Kunci (async: menunggu font ter-load).
 * =======================================================================*/
export async function generateHotsSoalPdf(data, meta = {}) {
  const fonts = await loadFonts();
  const info = normalize(data, meta);
  const r = newRenderer(fonts);
  drawHeader(r, "SOAL ULANGAN HOTS", info);

  info.soalList.forEach((s, idx) => {
    const nomor = s?.nomor ?? idx + 1;
    r.ensureSpace(48);
    r.writeRich(`No. ${nomor}   |   Level: ${levelLabel(s?.levelBloom)}`, r.marginX, { bold: true });
    r.writeContent(s?.pertanyaan || "", r.marginX);
    r.gap(4);

    if (info.isPg) {
      const opsi = s?.opsi || {};
      OPSI_KEYS.forEach((key) => {
        if (opsi[key] != null && String(opsi[key]).trim() !== "") {
          r.writeRich(`${key}. ${opsi[key]}`, r.marginX + 14);
        }
      });
    } else {
      for (let i = 0; i < 4; i++) {
        r.ensureSpace(20);
        r.gap(16);
        r.doc.setDrawColor(200);
        r.doc.setLineWidth(0.5);
        r.doc.line(r.marginX + 6, r.y, r.pageWidth - r.marginX, r.y);
      }
      r.gap(4);
    }

    r.gap(10);
    r.hr();
  });

  const filename = `HOTS_SOAL_${sanitizeFilePart(info.mataPelajaran)}_${Date.now()}.pdf`;
  r.doc.save(filename);
  return filename;
}

export async function generateHotsKunciPdf(data, meta = {}) {
  const fonts = await loadFonts();
  const info = normalize(data, meta);
  const r = newRenderer(fonts);
  drawHeader(r, "KUNCI JAWABAN & PEMBAHASAN", info);

  info.soalList.forEach((s, idx) => {
    const nomor = s?.nomor ?? idx + 1;
    r.ensureSpace(48);
    r.writeRich(`No. ${nomor}   |   Level: ${levelLabel(s?.levelBloom)}`, r.marginX, { bold: true });
    r.writeContent(s?.pertanyaan || "", r.marginX);
    r.gap(4);

    if (info.isPg) {
      const opsi = s?.opsi || {};
      const benar = String(s?.jawabanBenar ?? "").toUpperCase();
      OPSI_KEYS.forEach((key) => {
        if (opsi[key] != null && String(opsi[key]).trim() !== "") {
          const mark = key === benar ? "  ✓" : "";
          r.writeRich(`${key}. ${opsi[key]}${mark}`, r.marginX + 14, { bold: key === benar });
        }
      });
      r.gap(4);
      r.writeRich(`Jawaban Benar: ${benar || "-"}`, r.marginX, { bold: true });
      r.writeContent(`Pembahasan: ${s?.pembahasan ?? "-"}`, r.marginX);
    } else {
      r.gap(4);
      r.writeRich(`Kunci Jawaban:`, r.marginX, { bold: true });
      r.writeContent(String(s?.jawabanKunci ?? "-"), r.marginX);
      r.gap(2);
      r.writeRich(`Rubrik Penilaian:`, r.marginX, { bold: true });
      r.writeContent(String(s?.rubrikPenilaian ?? "-"), r.marginX);
      r.writeRich(`Skor Maksimal: ${s?.skorMaksimal ?? "-"}`, r.marginX, { bold: true });
    }

    r.gap(10);
    r.hr();
  });

  const filename = `HOTS_KUNCI_${sanitizeFilePart(info.mataPelajaran)}_${Date.now()}.pdf`;
  r.doc.save(filename);
  return filename;
}

export async function generateHotsPdf(data, meta = {}) {
  const soal = await generateHotsSoalPdf(data, meta);
  const kunci = await generateHotsKunciPdf(data, meta);
  return { soal, kunci };
}
