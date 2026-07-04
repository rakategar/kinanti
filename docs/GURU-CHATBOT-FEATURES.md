# 📚 Dokumentasi Fitur Chatbot Guru - Kinanti Bot

> **Tanggal Update:** 27 Desember 2025  
> **Branch:** New-NLP

---

## � Perubahan Alur (27 Desember 2025)

### Sebelumnya (NLP-Based)

Guru mengetik perintah langsung seperti "buat tugas", "rekap", dll. dan NLP mendeteksi intent.

### Sekarang (Menu-Based)

Guru memilih fitur dengan mengetik **angka** dari menu yang ditampilkan.

```
┌─────────────────────────────────────────────────────┐
│                 ALUR BARU GURU                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Guru: "halo" / "mulai" / "kinanti"                │
│         │                                           │
│         ▼                                           │
│  ┌─────────────────────────────────────┐           │
│  │ Bot menampilkan Menu:               │           │
│  │ 1. Buat Tugas Baru                  │           │
│  │ 2. Broadcast Tugas ke Kelas         │           │
│  │ 3. Rekap Excel Pengumpulan          │           │
│  │ 4. Lihat Daftar Siswa               │           │
│  │ 5. Gambar ke PDF                    │           │
│  │ 6. Bantuan                          │           │
│  │ 0. Keluar                           │           │
│  └──────────────┬──────────────────────┘           │
│                 │                                   │
│                 ▼                                   │
│  Guru: "1" (memilih Buat Tugas)                    │
│         │                                           │
│         ▼                                           │
│  Bot menjalankan wizard buat tugas                 │
│  (alur sama seperti sebelumnya)                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## �📋 Daftar Fitur Chatbot Guru

| No  | Menu            | Intent                 | Deskripsi                  | Status   |
| --- | --------------- | ---------------------- | -------------------------- | -------- |
| 1   | Buat Tugas Baru | `guru_buat_penugasan`  | Wizard form interaktif     | ✅ Aktif |
| 2   | Broadcast Tugas | `guru_broadcast_tugas` | Kirim tugas ke kelas       | ✅ Aktif |
| 3   | Rekap Excel     | `guru_rekap_excel`     | Download rekap pengumpulan | ✅ Aktif |
| 4   | Daftar Siswa    | `guru_list_siswa`      | Lihat siswa per kelas      | ✅ Aktif |
| 5   | Gambar ke PDF   | `img_to_pdf`           | Convert gambar ke PDF      | ✅ Aktif |
| 6   | Bantuan         | `guru_help`            | Penjelasan tiap menu       | ✅ Aktif |
| 0   | Keluar          | `guru_exit_menu`       | Keluar dari menu           | ✅ Aktif |

---

## 🔍 Detail Setiap Fitur

### 0. Masuk ke Menu (Trigger)

**Cara Masuk Menu:**
Guru mengetik salah satu kata sapaan:

- `halo`, `hai`, `hey`, `hei`
- `mulai`, `start`, `menu`
- `kinanti`, `assalamualaikum`

**Response Bot:**

```
👋 Halo, *[Nama Guru]*!

Selamat datang di *Kinanti Bot*.

📚 *Menu Guru:*
*1.* 📝 Buat Tugas Baru
*2.* 📢 Broadcast Tugas ke Kelas
*3.* 📊 Rekap Excel Pengumpulan
*4.* 👥 Lihat Daftar Siswa
*5.* 🖼️ Gambar ke PDF
*6.* ❓ Bantuan
*0.* 🚪 Keluar

📌 *Balas dengan angka* untuk memilih menu.
```

**State:** `menuMode: "guru_menu_selection"`

---

### 1. Buat Tugas - Wizard (`guru_buat_penugasan`)

**Trigger:** Ketik `1` dari menu

**Deskripsi:** Wizard interaktif untuk membuat tugas baru dengan multi-step form, termasuk opsi penilaian otomatis.

**File:** `src/controllers/guruController.js` (lines 77-490)

**Keywords di `intents.js`:**

- penugasan, buat tugas, tambah tugas, assignment, tugas baru, create assignment

**Alur Wizard:**

1. Guru pilih menu `1` dari menu utama
2. Bot tampilkan form kosong dengan opsi:

   ```
   - Kode:
   - Judul:
   - Deskripsi:
   - Lampirkan PDF (ya/tidak):
   - Penilaian Otomatis (ya/tidak):
   - Deadline: N (hari)
   - Kelas: (ketik kelas, misal: XIITKJ2)

   📌 *Jika sudah lengkap:*
   *1.* ✅ Simpan tugas
   *0.* ❌ Batalkan
   ```

3. Guru isi field satu per satu atau sekaligus
4. Jika `Lampirkan PDF: ya` → bot minta kirim file PDF (ketik `0` untuk lewati)
5. Jika `Penilaian Otomatis: ya` → bot minta kirim kunci jawaban PDF (ketik `0` untuk lewati)
6. Guru ketik `1` untuk simpan
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

**Perintah dalam Wizard (berbasis angka):**

| Angka | Aksi                            |
| ----- | ------------------------------- |
| `1`   | Simpan tugas                    |
| `0`   | Batalkan / Lewati (kontekstual) |

**Fitur Penilaian Otomatis:**

- Jika guru upload kunci jawaban, field `assignment.kunciJawaban` akan terisi URL
- Siswa yang mengumpulkan tugas ini akan dinilai otomatis via n8n + Gemini AI
- Tugas dengan penilaian otomatis ditandai 🟢 di daftar tugas siswa

---

### 2. Broadcast Tugas (`guru_broadcast_tugas`)

**Trigger:** Ketik `2` dari menu

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

### 3. Rekap Excel - Wizard (`guru_rekap_excel`)

**Trigger:** Ketik `3` dari menu

**Deskripsi:** Download rekap pengumpulan tugas dalam format Excel.

**File:** `src/controllers/guruController.js` (lines 590-789)

**Keywords di `intents.js`:**

- rekap, rekapan, rekap excel, excel tugas, export excel

**Alur Wizard (3 Step):**

**Step 1 - Start Wizard:**

1. Guru pilih menu `3` dari menu utama
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

### 4. List Siswa (`guru_list_siswa`)

**Trigger:** Ketik `4` dari menu

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

### 5. Gambar ke PDF (`img_to_pdf`)

**Trigger:** Ketik `5` dari menu

**Deskripsi:** Mengubah beberapa gambar menjadi 1 file PDF.

**File:** `src/features/imgToPdf.js`

**Keywords di `intents.js`:**

- gambar ke pdf, foto ke pdf, img to pdf, gambar jadi pdf, convert gambar ke pdf

**Alur:**

1. Guru pilih menu `5` dari menu utama
2. Bot masuk mode terima gambar
3. Guru kirim gambar (bisa multiple)
4. Guru ketik "selesai"
5. Bot gabung semua gambar jadi PDF
6. Bot kirim file PDF

**Note:** Fitur ini shared antara guru dan siswa.

---

### 6. Bantuan (`guru_help`)

**Trigger:** Ketik `6` dari menu

**Deskripsi:** Menampilkan penjelasan detail setiap menu.

**Output:**

```
❓ *Bantuan Menu Guru*

*1. Buat Tugas Baru*
   Membuat tugas baru dengan form interaktif.
   Bisa dengan/tanpa penilaian otomatis.

*2. Broadcast Tugas*
   Kirim pengumuman tugas ke semua siswa di kelas.

*3. Rekap Excel*
   Download rekap pengumpulan tugas dalam format Excel.

*4. Lihat Daftar Siswa*
   Melihat daftar siswa, bisa filter per kelas.

*5. Gambar ke PDF*
   Menggabungkan beberapa gambar menjadi 1 file PDF.

📌 Ketik angka untuk memilih menu, atau *0* untuk keluar.
```

---

### 0. Keluar (`guru_exit_menu`)

**Trigger:** Ketik `0` dari menu

**Deskripsi:** Keluar dari menu mode.

**Output:**

```
👋 Sampai jumpa! Ketik *halo* atau *mulai* kapan saja untuk kembali ke menu.
```

---

## 🔄 Perubahan Arsitektur (27 Desember 2025)

### Sebelum: NLP-Based

```
Guru → NLP Pipeline → Intent Detection → Controller
```

### Sesudah: Menu-Based + NLP Hybrid

```
Guru → Sapaan → Menu Selection Mode
         │
         ├── Ketik angka → Route ke Controller
         │
         └── Dalam Wizard → NLP untuk parsing form
```

### State Management Baru

```javascript
// server.js
const GURU_MENU_MAP = {
  1: "guru_buat_penugasan",
  2: "guru_broadcast_tugas",
  3: "guru_rekap_excel",
  4: "guru_list_siswa",
  5: "img_to_pdf",
  6: "guru_help",
  0: "guru_exit_menu",
};

// State untuk menu selection
state = {
  menuMode: "guru_menu_selection", // ← BARU
  lastIntent: null,
  slots: {},
};
```

### Keuntungan Alur Baru

1. **Lebih intuitif** - User tidak perlu mengingat keyword
2. **Mengurangi error NLP** - Tidak ada false positive dari nama file/kata umum
3. **Backward compatible** - Siswa tetap menggunakan NLP
4. **Wizard tetap sama** - Setelah pilih menu, alur wizard tidak berubah

---

## ⚠️ Catatan Penting

### 1. Guru HARUS Ketik Sapaan Dulu

Guru tidak bisa langsung ketik "1" tanpa melihat menu. Harus ketik "halo" / "mulai" dulu.

### 2. Wizard Tetap Menggunakan NLP

Setelah masuk wizard (misal buat tugas), parsing field seperti `Kode: MTK-001` tetap menggunakan NLP/regex.

### 3. Siswa Tidak Terpengaruh

Alur siswa tetap sama - menggunakan NLP untuk semua perintah.

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

| Menu | Fitur         | Intent                 | Trigger            | Status |
| ---- | ------------- | ---------------------- | ------------------ | ------ |
| -    | Masuk Menu    | -                      | halo/mulai/kinanti | ✅     |
| 1    | Buat Tugas    | `guru_buat_penugasan`  | Ketik `1`          | ✅     |
| 2    | Broadcast     | `guru_broadcast_tugas` | Ketik `2`          | ✅     |
| 3    | Rekap Excel   | `guru_rekap_excel`     | Ketik `3`          | ✅     |
| 4    | Daftar Siswa  | `guru_list_siswa`      | Ketik `4`          | ✅     |
| 5    | Gambar ke PDF | `img_to_pdf`           | Ketik `5`          | ✅     |
| 6    | Bantuan       | `guru_help`            | Ketik `6`          | ✅     |
| 0    | Keluar        | `guru_exit_menu`       | Ketik `0`          | ✅     |

---

## 📁 File Terkait

- `server.js` — Router utama & menu handler (DIUBAH)
- `src/services/state.js` — State management
- `src/controllers/guruController.js` — Handler fitur guru
- `src/features/imgToPdf.js` — Fitur gambar ke PDF
- `src/nlp/intents.js` — Definisi intent & keywords (untuk siswa)
- `src/nlp/dialogManager.js` — Slot filling & routing
- `src/nlp/pipeline.js` — Pipeline NLP
