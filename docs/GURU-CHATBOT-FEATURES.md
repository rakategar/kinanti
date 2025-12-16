# 📚 Dokumentasi Fitur Chatbot Guru - Kinanti Bot

> **Tanggal Update:** 11 Desember 2025  
> **Branch:** New-NLP

---

## 📋 Daftar Fitur Chatbot Guru

| No | Fitur | Intent | Keyword Trigger | Status |
|----|-------|--------|-----------------|--------|
| 1 | Sapaan & Menu | `sapaan_help` | halo, hai, kinanti, help, bantuan, menu | ✅ Aktif |
| 2 | Buat Tugas (Wizard) | `guru_buat_penugasan` | buat tugas, penugasan, tugas baru, assignment | ✅ Aktif |
| 3 | Broadcast Tugas | `guru_broadcast_tugas` | kirim tugas, broadcast tugas, sebar tugas, umumkan | ✅ Aktif |
| 4 | Rekap Excel (Wizard) | `guru_rekap_excel` | rekap, rekapan, rekap excel, excel tugas | ✅ Aktif |
| 5 | List Siswa | `guru_list_siswa` | list siswa, daftar siswa, lihat siswa, data siswa | ✅ Aktif |
| 6 | Gambar ke PDF | `guru_img_to_pdf` / `img_to_pdf` | gambar ke pdf, foto ke pdf | ✅ Aktif |
| 7 | Menu Guru | `guru_help` | bantuan guru, menu guru | ✅ Aktif |

---

## 🔍 Detail Setiap Fitur

### 1. Sapaan & Menu (`sapaan_help`)

**Deskripsi:** Menampilkan menu bantuan sesuai role user (guru/siswa).

**File:** `server.js` (lines 103-131)

**Alur:**
1. User ketik: "halo", "kinanti", "help", dll
2. Bot cek user di database
3. Jika belum terdaftar → tampilkan link registrasi
4. Jika guru → tampilkan menu guru
5. Jika siswa → tampilkan menu siswa

**Menu Guru yang Ditampilkan:**
```
📚 Menu Guru:
• buat tugas — Buat tugas baru
• kirim <KODE> <KELAS> — Broadcast tugas ke kelas
• rekap <KODE> <KELAS> — Download rekap Excel
• list siswa — Daftar siswa di kelas
• gambar ke pdf — Ubah foto jadi PDF
```

---

### 2. Buat Tugas - Wizard (`guru_buat_penugasan`)

**Deskripsi:** Wizard interaktif untuk membuat tugas baru dengan multi-step form, termasuk opsi penilaian otomatis.

**File:** `src/controllers/guruController.js` (lines 77-490)

**Keywords di `intents.js`:**
- penugasan, buat tugas, tambah tugas, assignment, tugas baru, create assignment

**Alur Wizard:**
1. Guru ketik "buat tugas"
2. Bot tampilkan form kosong
3. Guru isi field satu per satu atau sekaligus:
   - `Kode: MTK-001`
   - `Judul: Tugas Matematika BAB 1`
   - `Deskripsi: Kerjakan soal halaman 50`
   - `Lampirkan PDF (ya/tidak): ya`
   - `Penilaian Otomatis (ya/tidak): ya` ← **BARU**
   - `Deadline: 3` (hari)
   - `Kelas: XIITKJ2`
4. Jika `Lampirkan PDF: ya` → bot minta kirim file PDF
5. **Jika `Penilaian Otomatis: ya` → bot minta kirim kunci jawaban PDF** 🔑
6. Guru ketik "simpan"
7. Bot validasi dan simpan ke database (termasuk `kunciJawaban` URL)
8. Bot otomatis buat `AssignmentStatus` untuk semua siswa di kelas tersebut

**Validasi:**
- Kode wajib unik (cek duplikat)
- Format kelas: X/XI/XII + JURUSAN + NOMOR (contoh: XIITKJ2)
- PDF maks ~10MB
- **Kunci jawaban wajib jika penilaian otomatis = ya**

**State Management:**
- Menggunakan `getState`/`setState` dari `services/state.js`
- State key: `guru_buat_penugasan`

**Perintah Khusus dalam Wizard:**
- `simpan` → Simpan tugas
- `batal` → Batalkan wizard
- `lewati` → Skip lampiran PDF / kunci jawaban

**Fitur Penilaian Otomatis:**
- Jika guru upload kunci jawaban, field `assignment.kunciJawaban` akan terisi URL
- Siswa yang mengumpulkan tugas ini akan dinilai otomatis via n8n + Gemini AI
- Tugas dengan penilaian otomatis ditandai 🟢 di daftar tugas siswa

---

### 3. Broadcast Tugas (`guru_broadcast_tugas`)

**Deskripsi:** Mengirim pengumuman tugas ke semua siswa di kelas tertentu.

**File:** `src/controllers/guruController.js` (lines 524-588)

**Keywords di `intents.js`:**
- kirim tugas, broadcast tugas, sebar tugas, umumkan tugas, bagikan tugas

**Slot Required (di `dialogManager.js`):**
- `kode_tugas` — Kode tugas yang akan dibroadcast
- `kelas` — Kelas tujuan

**Contoh Penggunaan:**
```
kirim tugas BD-03 untuk XIITKJ2
broadcast tugas MTK-001 XIRPL1
```

**Alur:**
1. Guru ketik perintah dengan kode dan kelas
2. Bot validasi kode tugas ada di database
3. Bot ambil semua siswa di kelas tersebut
4. Bot kirim pesan ke setiap siswa dengan format:
   - Nama guru
   - Kode & Judul tugas
   - Deskripsi
   - Deadline
   - Link PDF lampiran (jika ada)
   - Instruksi cara mengumpulkan

**Format Broadcast ke Siswa:**
```
📢 *Tugas dari [Nama Guru]*
🔖 *Kode:* MTK-001
📚 *Judul:* Tugas Matematika
📝 *Deskripsi:*
[deskripsi tugas]
🗓️ *Deadline:* 15/12/2025 23:59
📎 *Lampiran PDF guru:* [URL jika ada]
🧾 *Harus mengumpulkan PDF:* Ya/Tidak

🧭 *Cara mengumpulkan:*
1) Balas chat ini dengan: *kumpul MTK-001*
2) Lampirkan *PDF* tugasmu (maks ~10MB)
3) Tekan kirim dan tunggu konfirmasi ✅
```

---

### 4. Rekap Excel - Wizard (`guru_rekap_excel`)

**Deskripsi:** Download rekap pengumpulan tugas dalam format Excel.

**File:** `src/controllers/guruController.js` (lines 590-789)

**Keywords di `intents.js`:**
- rekap, rekapan, rekap excel, excel tugas, export excel

**Alur Wizard (3 Step):**

**Step 1 - Start Wizard:**
1. Guru ketik "rekap"
2. Bot tampilkan daftar semua tugas milik guru
3. Bot minta pilih kode tugas

**Step 2 - Pick Code:**
1. Guru ketik kode tugas (misal: "MTK-001")
2. Bot validasi kode ada di database
3. Bot minta pilih kelas

**Step 3 - Pick Class:**
1. Guru ketik kelas (misal: "XIITKJ2")
2. Bot generate rekap:
   - Daftar siswa yang **belum mengumpulkan** (teks)
   - File Excel lengkap dengan semua siswa

**Shortcut:**
```
rekap MTK-001
```
→ Langsung ke Step 2 (skip daftar tugas)

**Format Excel:**
| Kelas | Siswa | Kode | Judul | Status | Waktu |
|-------|-------|------|-------|--------|-------|
| XIITKJ2 | Ahmad | MTK-001 | Tugas MTK | SELESAI | 12/12/2025 14:30 |
| XIITKJ2 | Budi | MTK-001 | Tugas MTK | BELUM_SELESAI | - |

**State Management:**
- Menggunakan `REKAP_WIZ` Map (in-memory)
- State key: `guru_rekap_wizard`

**Perintah Khusus:**
- `batal` → Batalkan wizard rekap

---

### 5. List Siswa (`guru_list_siswa`)

**Deskripsi:** Melihat daftar siswa, bisa filter per kelas.

**File:** `src/controllers/guruController.js` (lines 854-868)

**Keywords di `intents.js`:**
- list siswa, daftar siswa, lihat siswa, data siswa

**Contoh Penggunaan:**
```
list siswa
daftar siswa XIITKJ2
lihat siswa XI TKJ 1
```

**Output:**
```
👥 Daftar siswa XIITKJ2:
1. Ahmad — XIITKJ2
2. Budi — XIITKJ2
3. Citra — XIITKJ2
...
```

**Fitur:**
- Tanpa parameter → tampilkan semua siswa (max 200)
- Dengan kelas → filter siswa di kelas tersebut

---

### 6. Gambar ke PDF (`img_to_pdf` / `guru_img_to_pdf`)

**Deskripsi:** Mengubah beberapa gambar menjadi 1 file PDF.

**File:** `src/features/imgToPdf.js`

**Keywords di `intents.js`:**
- gambar ke pdf, foto ke pdf, img to pdf, gambar jadi pdf, convert gambar ke pdf

**Alur:**
1. Guru ketik "gambar ke pdf"
2. Bot masuk mode terima gambar
3. Guru kirim gambar (bisa multiple)
4. Guru ketik "selesai"
5. Bot gabung semua gambar jadi PDF
6. Bot kirim file PDF

**Note:** Fitur ini shared antara guru dan siswa.

---

### 7. Menu Guru (`guru_help`) ✅

**Deskripsi:** Menampilkan menu bantuan khusus untuk guru.

**File:** `src/controllers/guruController.js`

**Keywords di `intents.js`:**
- bantuan guru, menu guru

**Output:**
```
👋 Halo, *[Nama Guru]*!

📚 *Menu Guru:*
• *buat tugas* — Buat tugas baru
• *kirim <KODE> <KELAS>* — Broadcast tugas ke kelas
• *rekap <KODE>* — Download rekap Excel
• *list siswa* — Daftar siswa di kelas
• *gambar ke pdf* — Ubah foto jadi PDF

Ketik perintah di atas untuk mulai! 🚀
```

**Status:** ✅ Sudah diperbaiki (11 Desember 2025)

---

## ⚠️ Temuan & Perbaikan: Fitur yang Bertumpuk / Overlap

### 1. `guru_help` vs `sapaan_help` ✅ DIPERBAIKI

**Problem Awal:**
- `guru_help` (bantuan guru, menu guru) tidak ada handler
- `sapaan_help` sudah handle menu untuk guru

**Solusi yang Diterapkan:**
- ✅ Menambahkan handler `guru_help` di `guruController.js`
- Sekarang kedua intent bekerja:
  - `sapaan_help` → menu umum (detect role otomatis)
  - `guru_help` → menu khusus guru

### 2. `guru_img_to_pdf` vs `img_to_pdf`

**Problem:**
- Dua intent berbeda untuk fitur yang sama
- Di `server.js` sudah di-handle bersama:
  ```javascript
  if (intent === "img_to_pdf" || intent === "guru_img_to_pdf") {
    await startImgToPdf(message);
    return;
  }
  ```

**Status:** ✅ Sudah ditangani dengan baik (tidak perlu perbaikan)

### 3. Wizard State Conflict

**Problem Potensial:**
- `guru_buat_penugasan` menggunakan `getState`/`setState`
- `guru_rekap_excel` menggunakan `REKAP_WIZ` Map terpisah

**Status:** ✅ Tidak bertabrakan karena menggunakan storage berbeda

### 4. Routing Intent Guru di `server.js` ✅ DIPERBAIKI

**Problem Awal:**
```javascript
if (intent.startsWith("guru_")) {
  if (role === "guru") {
    return handleGuruCommand(...);
  } else {
    return handleSiswaCommand(...);  // ⚠️ Aneh: intent guru tapi ke siswa
  }
}
```

**Solusi yang Diterapkan:**
```javascript
if (intent.startsWith("guru_")) {
  if (role === "guru") {
    return handleGuruCommand(...);
  } else {
    return message.reply(
      "🔒 Maaf, fitur ini khusus untuk *Guru*.\n\n" +
      "Ketik *halo* untuk melihat menu siswa. 📚"
    );
  }
}
```

**Status:** ✅ Siswa sekarang mendapat pesan error yang jelas jika mencoba akses fitur guru

---

## 🛠️ Perbaikan yang Sudah Diterapkan (11 Desember 2025)

### 1. ✅ Handler `guru_help` Ditambahkan

**File:** `src/controllers/guruController.js`

Menambahkan case baru di switch statement:
```javascript
case "guru_help": {
  const userName = user.nama || "Guru";
  const menuGuru = `👋 Halo, *${userName}*!\n\n` + ...;
  return message.reply(menuGuru);
}
```

### 2. ✅ Routing Guru Diperbaiki

**File:** `server.js`

Siswa yang mencoba akses fitur guru sekarang mendapat pesan:
```
🔒 Maaf, fitur ini khusus untuk *Guru*.

Ketik *halo* untuk melihat menu siswa. 📚
```

---

## 📊 Ringkasan Status Fitur

| Fitur | Intent | Handler | State | Status |
|-------|--------|---------|-------|--------|
| Sapaan | `sapaan_help` | server.js | - | ✅ |
| Buat Tugas | `guru_buat_penugasan` | guruController | getState | ✅ |
| Broadcast | `guru_broadcast_tugas` | guruController | dialogManager | ✅ |
| Rekap Excel | `guru_rekap_excel` | guruController | REKAP_WIZ | ✅ |
| List Siswa | `guru_list_siswa` | guruController | - | ✅ |
| Gambar ke PDF | `img_to_pdf` | imgToPdf.js | - | ✅ |
| Menu Guru | `guru_help` | guruController | - | ✅ |

---

## 📁 File Terkait

- `src/nlp/intents.js` — Definisi intent & keywords
- `src/nlp/classifier.js` — Klasifikasi intent
- `src/nlp/dialogManager.js` — Slot filling & routing
- `src/nlp/pipeline.js` — Pipeline NLP
- `src/controllers/guruController.js` — Handler fitur guru
- `src/features/imgToPdf.js` — Fitur gambar ke PDF
- `src/services/state.js` — State management
- `server.js` — Router utama & WhatsApp listener
