# Arsitektur NLP Kinanti Chatbot

Dokumentasi ini menjelaskan bagaimana sistem Natural Language Processing (NLP) bekerja pada chatbot Kinanti untuk memproses pesan WhatsApp dari siswa dan guru.

## 📊 Overview Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NLP PIPELINE FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   📥 Input (Pesan WhatsApp)                                             │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────┐                                                       │
│   │ NORMALIZER  │  → Lowercase, hapus emoji, mapping slang              │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  ENTITIES   │  → Ekstrak: kode_tugas, kelas, tanggal                │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │ CLASSIFIER  │  → Tentukan intent berdasarkan keyword + entities     │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │   DIALOG    │  → Slot filling, state management, routing            │
│   │   MANAGER   │                                                       │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  CONTROLLER │  → siswaController / guruController                   │
│   └─────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔧 Komponen Utama

### 1. Normalizer (`src/nlp/normalizer.js`)

**Fungsi:** Membersihkan dan menstandarisasi teks input.

**Proses:**

1. **Lowercase** - Semua huruf dijadikan huruf kecil
2. **Hapus karakter non-alfanumerik** - Emoji, tanda baca dihilangkan
3. **Mapping slang** - Kata informal diubah ke bentuk standar

**Contoh Mapping Slang:**

```javascript
const SLANG = {
  gmn: "gimana",
  ngumpulin: "kumpul",
  tgs: "tugas",
  uplod: "upload",
  besuk: "besok",
  mau: "ingin",
  pengen: "ingin",
};
```

**Contoh Transformasi:**
| Input | Output |
|-------|--------|
| `Mau ngumpulin TGS MTK001` | `ingin kumpul tugas mtk001` |
| `Gmn cara upload? 📎` | `gimana cara upload` |

---

### 2. Entity Extractor (`src/nlp/entities.js`)

**Fungsi:** Mengekstrak informasi penting (entities) dari teks.

**Entities yang Diekstrak:**

| Entity       | Deskripsi       | Regex Pattern          | Contoh                  |
| ------------ | --------------- | ---------------------- | ----------------------- | ------------------------------------- | ----------------- |
| `kode_tugas` | Kode penugasan  | `/\b([A-Z]{2,15}(?:\d+ | [-\_][A-Z0-9]+)\*)\b/g` | MTK001, IPA-1, TANAMAN                |
| `kelas`      | Kelas siswa     | `/\b(x                 | xi                      | xii)\s*([a-z]{2,6})\s*(\d{1,2})\b/gi` | XIITKJ2, XI RPL 1 |
| `tanggal`    | Tanggal relatif | Keyword matching       | besok, lusa, hari ini   |

**Filter COMMON_WORDS:**
Untuk menghindari false positive, kata-kata umum difilter:

```javascript
const COMMON_WORDS = new Set([
  // Sapaan
  "halo",
  "hai",
  "kinanti",
  "help",
  "bantuan",
  // Kata kerja
  "kumpul",
  "buat",
  "kirim",
  "rekap",
  // Perintah wizard
  "simpan",
  "batal",
  "cancel",
  // Kata dari nama file
  "soal",
  "jawaban",
  "ujian",
  "latihan",
  // ... dan lainnya
]);
```

---

### 3. Classifier (`src/nlp/classifier.js`)

**Fungsi:** Menentukan intent (maksud) pengguna berdasarkan teks dan entities.

**Metode:** Rule-based scoring dengan keyword matching.

**Algoritma Scoring:**

```
Score = Σ(keyword match) + Σ(entity match × 1.5) + boost
```

**Intent yang Didukung:**

| Intent                 | Keyword Utama            | Boost                 |
| ---------------------- | ------------------------ | --------------------- |
| `sapaan_help`          | halo, hai, kinanti, menu | +3                    |
| `siswa_list_tugas`     | tugas saya, daftar tugas | -                     |
| `siswa_kumpul_tugas`   | kumpul, upload tugas     | +2 (+2 jika ada kode) |
| `siswa_detail_tugas`   | detail, info tugas       | +2 jika ada kode      |
| `guru_buat_penugasan`  | buat tugas, penugasan    | +4                    |
| `guru_rekap_excel`     | rekap, export excel      | +3                    |
| `guru_list_siswa`      | list siswa, data siswa   | +3                    |
| `guru_broadcast_tugas` | kirim tugas, broadcast   | +3                    |

**Contoh Klasifikasi:**

```
Input: "hai kinanti"
├── sapaan_help: score=1 (keyword) + 3 (boost) = 4 ✓
├── siswa_detail_tugas: score=0
└── Result: intent="sapaan_help", confidence=1.0

Input: "kumpul tugas MTK001"
├── siswa_kumpul_tugas: score=1 + 2 (boost) + 2 (ada kode) = 5 ✓
├── siswa_detail_tugas: score=0
└── Result: intent="siswa_kumpul_tugas", confidence=1.0
```

---

### 4. Dialog Manager (`src/nlp/dialogManager.js`)

**Fungsi:** Mengelola state percakapan dan slot filling.

**Fitur Utama:**

#### a) State Management

Menyimpan state percakapan per user via Redis/memory:

```javascript
state = {
  lastIntent: "siswa_kumpul_tugas",
  slots: {
    kode_tugas: "MTK001",
    kelas: null,
  },
};
```

#### b) Slot Filling

Meminta data yang belum lengkap:

```javascript
const SLOT_RULES = {
  siswa_kumpul_tugas: ["kode_tugas"],
  guru_broadcast_tugas: ["kode_tugas", "kelas"],
};

const SLOT_PROMPTS = {
  kode_tugas: "Kodenya berapa? (contoh: BD-03)",
  kelas: "Untuk kelas mana? (contoh: XIITKJ2)",
};
```

#### c) Wizard Mode

Untuk intent kompleks seperti `guru_buat_penugasan`:

- State dipertahankan sampai user mengetik "simpan" atau "batal"
- Entities dari pesan (nama file PDF) tidak akan menimpa slot wizard

#### d) Dialog Continuation

Jika user sudah dalam dialog dan mengirim data tanpa intent baru:

```
User: "kumpul tugas"
Bot: "Kodenya berapa?"
User: "MTK001"         ← Dikenali sebagai lanjutan dialog
Bot: "Silakan kirim file PDF..."
```

---

## 🔄 Flow Lengkap

### Contoh 1: Siswa Kumpul Tugas

```
1. User: "mau ngumpulin tgs MTK001"
   │
2. NORMALIZER: "ingin kumpul tugas mtk001"
   │
3. ENTITIES: { kode_tugas: "MTK001" }
   │
4. CLASSIFIER: intent="siswa_kumpul_tugas", score=5
   │
5. DIALOG MANAGER:
   ├── Check slots: kode_tugas ✓ (sudah ada)
   ├── Clear state
   └── Return: { action: "ROUTE", to: "siswa_kumpul_tugas" }
   │
6. CONTROLLER: siswaController.handleKumpulTugas()
```

### Contoh 2: Guru Buat Tugas (Wizard)

```
1. User: "buat tugas"
   │
2. NORMALIZER: "buat tugas"
   │
3. ENTITIES: { } (kosong)
   │
4. CLASSIFIER: intent="guru_buat_penugasan", score=5
   │
5. DIALOG MANAGER:
   ├── Set state: lastIntent="guru_buat_penugasan"
   └── Return: { action: "ROUTE", to: "guru_buat_penugasan" }
   │
6. CONTROLLER: guruController menampilkan form wizard
   │
   User mengisi form...
   │
7. User: "simpan"
   │
8. DIALOG MANAGER:
   ├── Detect "simpan" → trigger save
   └── Clear state
```

### Contoh 3: Multi-turn Dialog (Slot Filling)

```
1. User: "kumpul tugas"
   │
2. CLASSIFIER: intent="siswa_kumpul_tugas"
   │
3. DIALOG MANAGER:
   ├── Check slots: kode_tugas ✗ (belum ada)
   ├── Set state: { lastIntent: "siswa_kumpul_tugas" }
   └── Return: { action: "ASK_SLOT", message: "Kodenya berapa?" }
   │
4. Bot: "Kodenya berapa? (contoh: BD-03)"
   │
5. User: "MTK001"
   │
6. ENTITIES: { kode_tugas: "MTK001" }
   │
7. DIALOG MANAGER:
   ├── lastIntent exists → Continue dialog
   ├── Merge slots: { kode_tugas: "MTK001" }
   ├── All slots filled ✓
   └── Return: { action: "ROUTE", to: "siswa_kumpul_tugas" }
```

---

## 📁 Struktur File

```
src/nlp/
├── pipeline.js      # Orchestrator utama
├── normalizer.js    # Text preprocessing
├── entities.js      # Entity extraction
├── classifier.js    # Intent classification
├── dialogManager.js # State & slot management
└── intents.js       # Intent definitions

src/services/
├── state.js         # State storage (Redis/memory)
└── logger.js        # NLP logging

src/controllers/
├── siswaController.js  # Handler untuk intent siswa
└── guruController.js   # Handler untuk intent guru
```

---

## 🎯 Confidence Score

Confidence dihitung dari skor klasifikasi:

```javascript
confidence = Math.max(0, Math.min(1, score / 3));
```

| Score | Confidence | Interpretasi              |
| ----- | ---------- | ------------------------- |
| 0     | 0.0        | Tidak dikenali (fallback) |
| 1-2   | 0.3-0.6    | Rendah                    |
| 3+    | 1.0        | Tinggi                    |

---

## 🔧 Tips Debugging

### Melihat Log Pipeline

```javascript
// Output di console saat memproses pesan:
========== NLP PIPELINE START ==========
📥 RAW INPUT: hai kinanti
🔄 NORMALIZED: hai kinanti
🏷️  ENTITIES: { kode_tugas: null, kelas: null }
🎯 CLASSIFIED:
   - Intent: sapaan_help
   - Score: 4
   - Confidence: 1
💬 DIALOG MANAGER:
   - Done: true
   - Action: ROUTE
   - To: sapaan_help
========== NLP PIPELINE END ==========
```

### Test Entity Extraction

```bash
node -e "
const {extractEntities} = require('./src/nlp/entities');
console.log(extractEntities('kumpul tugas MTK001 kelas XII TKJ 2'));
"
# Output: { kode_tugas: 'MTK001', kelas: 'XIITKJ2', tanggal: null }
```

### Test Classifier

```bash
node -e "
const {classify} = require('./src/nlp/classifier');
const {extractEntities} = require('./src/nlp/entities');
const entities = extractEntities('buat tugas');
console.log(classify('buat tugas', entities));
"
# Output: { intent: 'guru_buat_penugasan', confidence: 1, score: 5 }
```

---

## 📝 Catatan Penting

1. **NLP ini rule-based**, bukan machine learning. Cocok untuk domain terbatas dengan keyword yang jelas.

2. **Urutan boost penting** - Intent dengan boost lebih tinggi akan menang jika ada konflik.

3. **COMMON_WORDS filter** - Pastikan kata-kata umum yang muncul di nama file tidak terdeteksi sebagai kode tugas.

4. **Wizard mode** - Intent `guru_buat_penugasan` memiliki behavior khusus dimana state dipertahankan dan entities tidak di-merge otomatis.

5. **Alias entities** - `kode`, `kode_tugas`, dan `assignmentCode` adalah alias yang sama untuk kompatibilitas.
