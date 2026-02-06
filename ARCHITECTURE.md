# 📚 Dokumentasi Arsitektur Kinanti LMS

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Teknologi yang Digunakan](#teknologi-yang-digunakan)
4. [Struktur Proyek](#struktur-proyek)
5. [Fitur Aplikasi](#fitur-aplikasi)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [WhatsApp Bot](#whatsapp-bot)
9. [NLP Pipeline](#nlp-pipeline)
10. [Deployment](#deployment)
11. [Environment Variables](#environment-variables)

---

## Overview

**Kinanti** adalah Learning Management System (LMS) berbasis web yang terintegrasi dengan WhatsApp Bot. Sistem ini dirancang untuk memudahkan interaksi antara guru dan siswa dalam pengelolaan tugas, pengumpulan, dan penilaian.

### Keunikan Kinanti:

- 🤖 **WhatsApp-First**: Siswa dapat berinteraksi melalui WhatsApp tanpa perlu akses web
- 🧠 **NLP-Powered**: Bot memahami bahasa natural dalam Bahasa Indonesia
- 📱 **Mobile Friendly**: Interface responsif untuk akses dari berbagai perangkat
- ⚡ **Real-time**: Notifikasi tugas langsung ke WhatsApp siswa

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         KINANTI LMS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────────────────┐ │
│  │   Web App        │         │      WhatsApp Bot            │ │
│  │   (Next.js)      │         │      (Node.js)               │ │
│  │                  │         │                              │ │
│  │  ┌────────────┐  │         │  ┌────────────────────────┐  │ │
│  │  │  Frontend  │  │         │  │    NLP Pipeline        │  │ │
│  │  │  (React)   │  │         │  │  ┌──────────────────┐  │  │ │
│  │  └────────────┘  │         │  │  │ Normalizer       │  │  │ │
│  │        │         │         │  │  │ Entity Extractor │  │  │ │
│  │  ┌────────────┐  │   API   │  │  │ Intent Classifier│  │  │ │
│  │  │  API       │◄─┼────────►│  │  │ Dialog Manager   │  │  │ │
│  │  │  Routes    │  │         │  │  └──────────────────┘  │  │ │
│  │  └────────────┘  │         │  └────────────────────────┘  │ │
│  │        │         │         │            │                 │ │
│  └────────┼─────────┘         └────────────┼─────────────────┘ │
│           │                                │                   │
│           └────────────┬───────────────────┘                   │
│                        │                                       │
│              ┌─────────▼─────────┐                             │
│              │     Prisma ORM    │                             │
│              └─────────┬─────────┘                             │
│                        │                                       │
│              ┌─────────▼─────────┐                             │
│              │    PostgreSQL     │                             │
│              │    (Supabase)     │                             │
│              └───────────────────┘                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Vercel     │  │  Cloudflare  │  │  WhatsApp Web.js   │    │
│  │  (Web Host)  │  │   Tunnel     │  │    (WA Client)     │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Komponen Utama:

| Komponen         | Deskripsi                                    | Lokasi          |
| ---------------- | -------------------------------------------- | --------------- |
| **Web App**      | Dashboard untuk guru, halaman login/register | `/src/app/`     |
| **WhatsApp Bot** | Bot untuk interaksi siswa & guru via WA      | `/bot kinanti/` |
| **Database**     | PostgreSQL hosted di Supabase                | Cloud           |
| **Tunnel**       | Cloudflare Tunnel untuk expose bot           | Local           |

---

## Teknologi yang Digunakan

### 🌐 Web Application

| Teknologi          | Versi   | Fungsi                            |
| ------------------ | ------- | --------------------------------- |
| **Next.js**        | 15.5.9  | React framework dengan App Router |
| **React**          | 19.0.0  | UI library                        |
| **Tailwind CSS**   | 4.0.9   | Utility-first CSS framework       |
| **NextAuth.js**    | 4.24.11 | Authentication                    |
| **SweetAlert2**    | 11.17.2 | Modal & alerts                    |
| **React Dropzone** | 14.3.8  | File upload                       |
| **Motion**         | 12.5.0  | Animasi                           |

### 🤖 WhatsApp Bot

| Teknologi           | Versi   | Fungsi                          |
| ------------------- | ------- | ------------------------------- |
| **Node.js**         | ≥18.0.0 | Runtime                         |
| **whatsapp-web.js** | 1.34.4  | WhatsApp Web client             |
| **Express**         | 5.1.0   | HTTP server untuk API broadcast |
| **node-cron**       | 3.0.3   | Scheduled tasks (reminder)      |
| **pdf-lib**         | 1.17.1  | Generate/manipulate PDF         |
| **ExcelJS**         | 4.4.0   | Export rekap ke Excel           |
| **Sharp**           | 0.33.5  | Image processing                |

### 🗄️ Database & ORM

| Teknologi      | Versi | Fungsi                     |
| -------------- | ----- | -------------------------- |
| **PostgreSQL** | -     | Database utama             |
| **Supabase**   | -     | Database hosting & storage |
| **Prisma**     | 6.4.1 | ORM & database toolkit     |

### 🚀 Deployment & Infrastructure

| Teknologi             | Fungsi                    |
| --------------------- | ------------------------- |
| **Vercel**            | Hosting web app (Next.js) |
| **Cloudflare Tunnel** | Expose bot ke internet    |
| **Google Chrome**     | Headless browser untuk WA |

---

## Struktur Proyek

```
kinantibaru/
│
├── 📁 src/                      # Web App (Next.js)
│   ├── 📁 app/
│   │   ├── 📁 api/              # API Routes
│   │   │   ├── assignments/     # CRUD tugas
│   │   │   ├── auth/            # NextAuth
│   │   │   ├── guru/            # API khusus guru
│   │   │   │   ├── assessments/ # Penilaian/ujian
│   │   │   │   ├── assignments/ # Tugas
│   │   │   │   ├── broadcast/   # Broadcast WA
│   │   │   │   ├── penilaian/   # Nilai siswa
│   │   │   │   └── rekap/       # Rekap pengumpulan
│   │   │   ├── register/        # Registrasi user
│   │   │   └── upload-tugas/    # Upload submission
│   │   │
│   │   ├── 📁 components/       # Reusable components
│   │   ├── 📁 dashboard/        # Halaman dashboard siswa
│   │   ├── 📁 guru/             # Halaman dashboard guru
│   │   ├── 📁 login/            # Halaman login
│   │   ├── 📁 register/         # Halaman register
│   │   └── 📁 buatsoal/         # Halaman buat soal
│   │
│   └── middleware.js            # Auth middleware
│
├── 📁 bot kinanti/              # WhatsApp Bot (Terpisah)
│   ├── server.js                # Entry point bot
│   ├── package.json             # Dependencies bot
│   ├── .env                     # Environment variables
│   ├── start.sh                 # Start bot + tunnel (2 terminal)
│   ├── start-bg.sh              # Start di background
│   ├── stop.sh                  # Stop semua proses
│   │
│   ├── 📁 src/
│   │   ├── 📁 client/           # WhatsApp client setup
│   │   ├── 📁 config/           # Prisma & Supabase config
│   │   ├── 📁 controllers/      # Business logic
│   │   │   ├── guruController.js
│   │   │   ├── siswaController.js
│   │   │   └── scheduleController.js
│   │   ├── 📁 features/         # Fitur tambahan
│   │   │   └── imgToPdf.js      # Convert gambar ke PDF
│   │   ├── 📁 nlp/              # NLP Pipeline
│   │   │   ├── pipeline.js      # Main pipeline
│   │   │   ├── normalizer.js    # Text normalization
│   │   │   ├── entities.js      # Entity extraction
│   │   │   ├── classifier.js    # Intent classification
│   │   │   ├── intents.js       # Intent definitions
│   │   │   └── dialogManager.js # Dialog state management
│   │   ├── 📁 services/
│   │   │   ├── state.js         # User state & JID mapping
│   │   │   └── logger.js        # NLP logging
│   │   └── 📁 utils/
│   │       ├── waHelper.js      # WhatsApp helper (safe send)
│   │       ├── pdfUtil.js       # PDF utilities
│   │       ├── excelUtil.js     # Excel export
│   │       └── phone.js         # Phone number utilities
│   │
│   ├── 📁 routes/
│   │   └── broadcast.js         # Broadcast API endpoint
│   │
│   ├── 📁 cloudflared/
│   │   └── config.yml           # Cloudflare tunnel config
│   │
│   └── 📁 prisma/
│       ├── schema.prisma        # Database schema
│       └── 📁 migrations/       # Database migrations
│
├── 📁 prisma/                   # Prisma (shared with web)
├── 📁 public/                   # Static assets
├── 📁 docs/                     # Dokumentasi tambahan
├── package.json                 # Web app dependencies
└── .env                         # Web app environment
```

---

## Fitur Aplikasi

### 👨‍🏫 Fitur Guru

#### Via Web Dashboard

| Fitur               | Deskripsi                                                       |
| ------------------- | --------------------------------------------------------------- |
| **Buat Tugas**      | Membuat tugas baru dengan kode unik, judul, deskripsi, deadline |
| **Upload PDF**      | Melampirkan file PDF sebagai materi tugas                       |
| **Lihat Rekap**     | Melihat daftar siswa yang sudah/belum mengumpulkan              |
| **Broadcast**       | Kirim notifikasi tugas ke semua siswa via WhatsApp              |
| **Penilaian**       | Memberikan nilai dan feedback untuk submission                  |
| **Export Excel**    | Download rekap dalam format Excel                               |
| **Buat Assessment** | Membuat soal ujian/quiz online                                  |

#### Via WhatsApp Bot

| Command               | Deskripsi                      |
| --------------------- | ------------------------------ |
| `buat tugas [kode]`   | Mulai wizard pembuatan tugas   |
| `lihat tugas`         | Daftar tugas yang sudah dibuat |
| `rekap [kode]`        | Lihat rekap pengumpulan        |
| `status tugas [kode]` | Detail status tugas tertentu   |
| `gambar ke pdf`       | Convert gambar ke PDF          |

### 👨‍🎓 Fitur Siswa

#### Via WhatsApp Bot

| Command                       | Deskripsi                         |
| ----------------------------- | --------------------------------- |
| `tugas saya` / `daftar tugas` | Lihat tugas yang belum dikerjakan |
| `kumpulkan [kode]`            | Mulai proses pengumpulan tugas    |
| `status tugas`                | Lihat status semua tugas          |
| `gambar ke pdf`               | Convert gambar ke PDF             |
| `help` / `bantuan`            | Tampilkan menu bantuan            |

### 🤖 Fitur Bot Umum

| Fitur                              | Deskripsi                                     |
| ---------------------------------- | --------------------------------------------- |
| **Natural Language Understanding** | Bot memahami perintah dalam bahasa natural    |
| **Auto Greeting**                  | Respons sapaan otomatis                       |
| **Deadline Reminder**              | Notifikasi otomatis H-1 deadline              |
| **Image to PDF**                   | Konversi multiple gambar ke satu file PDF     |
| **LID Support**                    | Support WhatsApp Linked Device (multi-device) |

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────────┐
│      User       │       │     Assignment      │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │       │ id (PK)             │
│ nama            │       │ kode (UNIQUE)       │
│ phone (UNIQUE)  │◄──────┤ guruId (FK)         │
│ password        │       │ kelas               │
│ role (enum)     │       │ judul               │
│ kelas (enum)    │       │ deskripsi           │
└────────┬────────┘       │ pdfUrl              │
         │                │ deadline            │
         │                │ kunciJawaban        │
         │                └──────────┬──────────┘
         │                           │
         │    ┌──────────────────────┼──────────────────────┐
         │    │                      │                      │
         │    ▼                      ▼                      │
┌────────┴────────────┐  ┌─────────────────────────┐        │
│  AssignmentStatus   │  │ AssignmentSubmission    │        │
├─────────────────────┤  ├─────────────────────────┤        │
│ id (PK)             │  │ id (PK)                 │        │
│ siswaId (FK)        │  │ siswaId (FK)            │        │
│ tugasId (FK)        │  │ tugasId (FK)            │        │
│ status (enum)       │  │ pdfUrl                  │        │
└─────────────────────┘  │ grade                   │        │
                         │ score                   │        │
                         │ evaluation              │        │
                         └─────────────────────────┘        │
                                                            │
┌─────────────────────┐  ┌─────────────────────────┐        │
│  PhoneJidMapping    │  │     Assessment          │◄───────┘
├─────────────────────┤  ├─────────────────────────┤
│ id (PK)             │  │ id (PK)                 │
│ phone (UNIQUE)      │  │ guruId                  │
│ jid                 │  │ code (UNIQUE)           │
└─────────────────────┘  │ title                   │
                         │ className               │
┌─────────────────────┐  └───────────┬─────────────┘
│  ConversationState  │              │
├─────────────────────┤              ▼
│ id (PK)             │  ┌─────────────────────────┐
│ userPhone (UNIQUE)  │  │       Question          │
│ lastIntent          │  ├─────────────────────────┤
│ slots (JSON)        │  │ id (PK)                 │
└─────────────────────┘  │ assessmentId (FK)       │
                         │ data (JSON)             │
┌─────────────────────┐  └─────────────────────────┘
│      NlpLog         │
├─────────────────────┤
│ id (PK)             │
│ userPhone           │
│ text                │
│ predicted           │
│ confidence          │
│ entities (JSON)     │
└─────────────────────┘
```

### Enums

```prisma
enum Role {
  guru
  siswa
}

enum Kelas {
  XTKJ1    // Kelas X TKJ 1
  XTKJ2    // Kelas X TKJ 2
  XITKJ1   // Kelas XI TKJ 1
  XITKJ2   // Kelas XI TKJ 2
  XIITKJ1  // Kelas XII TKJ 1
  XIITKJ2  // Kelas XII TKJ 2
  TPTUP    // Tata Usaha
}

enum TugasStatus {
  BELUM_SELESAI
  SELESAI
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint                  | Deskripsi            |
| ------ | ------------------------- | -------------------- |
| POST   | `/api/auth/[...nextauth]` | NextAuth handler     |
| POST   | `/api/register`           | Registrasi user baru |

### Assignments (Tugas)

| Method | Endpoint                               | Deskripsi             |
| ------ | -------------------------------------- | --------------------- |
| GET    | `/api/assignments`                     | List semua tugas      |
| POST   | `/api/assignments`                     | Buat tugas baru       |
| GET    | `/api/assignments/check-kode?kode=XXX` | Cek ketersediaan kode |
| POST   | `/api/assignments/duplicate`           | Duplikat tugas        |

### Guru Dashboard

| Method   | Endpoint                      | Deskripsi                  |
| -------- | ----------------------------- | -------------------------- |
| GET      | `/api/guru/assignments`       | List tugas guru            |
| POST     | `/api/guru/create-assignment` | Buat tugas (dengan upload) |
| GET      | `/api/guru/rekap?kode=XXX`    | Rekap pengumpulan          |
| POST     | `/api/guru/broadcast`         | Broadcast ke WhatsApp      |
| GET/POST | `/api/guru/penilaian`         | Penilaian submission       |

### Assessments (Ujian)

| Method | Endpoint                                 | Deskripsi            |
| ------ | ---------------------------------------- | -------------------- |
| GET    | `/api/guru/assessments`                  | List assessment      |
| POST   | `/api/guru/assessments`                  | Buat assessment baru |
| GET    | `/api/guru/assessments/[code]`           | Detail assessment    |
| GET    | `/api/guru/assessments/[code]/questions` | List soal            |
| POST   | `/api/guru/assessments/[code]/questions` | Tambah soal          |

### Submission

| Method | Endpoint                        | Deskripsi               |
| ------ | ------------------------------- | ----------------------- |
| POST   | `/api/upload-tugas`             | Upload submission siswa |
| GET    | `/api/submission-detail?id=XXX` | Detail submission       |

### Bot API (Internal)

| Method | Endpoint                             | Deskripsi          |
| ------ | ------------------------------------ | ------------------ |
| POST   | `http://bot.kinantiku.com/broadcast` | Broadcast pesan WA |

---

## WhatsApp Bot

### Cara Kerja

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User WA   │────▶│   Bot WA    │────▶│   server.js │
│   Message   │     │   Client    │     │   Handler   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┴───────────┐
                    │                                      │
                    ▼                                      ▼
            ┌───────────────┐                    ┌─────────────────┐
            │ NLP Pipeline  │                    │ Direct Command  │
            │ (Natural Lang)│                    │ (Structured)    │
            └───────┬───────┘                    └────────┬────────┘
                    │                                     │
                    ├─────────────────────────────────────┤
                    │                                     │
                    ▼                                     ▼
            ┌───────────────┐                    ┌─────────────────┐
            │ Guru          │                    │ Siswa           │
            │ Controller    │                    │ Controller      │
            └───────────────┘                    └─────────────────┘
```

### Message Flow

1. **Receive**: `whatsapp-web.js` menerima pesan masuk
2. **Resolve JID**: Handle `@lid` untuk linked device
3. **Identify Role**: Cek role user (guru/siswa) dari database
4. **Route**: Kirim ke controller yang sesuai
5. **NLP Process**: Parse intent dan entities
6. **Execute**: Jalankan action sesuai intent
7. **Reply**: Kirim respons ke user

### JID Mapping (LID Support)

WhatsApp Linked Device menggunakan format JID berbeda (`@lid` vs `@c.us`). Bot menyimpan mapping:

```javascript
// Saat user chat pertama kali
setPhoneJid("62895396334564", "183154702835811@lid");

// Saat broadcast, lookup mapping
const jid = getJidByPhone("62895396334564");
// → "183154702835811@lid"
```

---

## NLP Pipeline

### Arsitektur NLP

```
┌──────────────────────────────────────────────────────────────┐
│                       NLP PIPELINE                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Input: "saya mau kumpulkan tugas TGS001"                   │
│                           │                                  │
│                           ▼                                  │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  1. NORMALIZER                                        │  │
│   │  - Lowercase                                          │  │
│   │  - Remove extra whitespace                            │  │
│   │  - Expand abbreviations (tgs→tugas, sy→saya)          │  │
│   │                                                       │  │
│   │  Output: "saya mau kumpulkan tugas tgs001"            │  │
│   └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  2. ENTITY EXTRACTOR                                  │  │
│   │  - Detect kode tugas: TGS001                          │  │
│   │  - Detect kelas: XTKJ1, XITKJ2, etc                   │  │
│   │  - Detect deadline: tanggal, jam                      │  │
│   │                                                       │  │
│   │  Output: { kode: "TGS001" }                           │  │
│   └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  3. INTENT CLASSIFIER                                 │  │
│   │  - Match keywords                                     │  │
│   │  - Calculate confidence score                         │  │
│   │                                                       │  │
│   │  Output: { intent: "siswa_kumpul_tugas",              │  │
│   │            confidence: 0.85 }                         │  │
│   └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  4. DIALOG MANAGER                                    │  │
│   │  - Manage conversation state                          │  │
│   │  - Slot filling (kode, kelas, deadline)               │  │
│   │  - Multi-turn conversation                            │  │
│   │                                                       │  │
│   │  Output: { action: "kumpul_tugas",                    │  │
│   │            slots: { kode: "TGS001" },                 │  │
│   │            done: true }                               │  │
│   └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   Result: Route to siswaController.handleKumpulTugas()       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Daftar Intent

#### Intent Umum

| Intent        | Keywords                   | Deskripsi      |
| ------------- | -------------------------- | -------------- |
| `sapaan_help` | halo, hai, bantuan, menu   | Sapaan & help  |
| `img_to_pdf`  | gambar ke pdf, foto ke pdf | Convert gambar |

#### Intent Siswa

| Intent               | Keywords                 | Deskripsi    |
| -------------------- | ------------------------ | ------------ |
| `siswa_list_tugas`   | tugas saya, daftar tugas | Lihat tugas  |
| `siswa_kumpul_tugas` | kumpulkan, submit, kirim | Kumpul tugas |
| `siswa_status_tugas` | status tugas             | Cek status   |

#### Intent Guru

| Intent              | Keywords                  | Deskripsi         |
| ------------------- | ------------------------- | ----------------- |
| `guru_buat_tugas`   | buat tugas, tambah tugas  | Wizard buat tugas |
| `guru_list_tugas`   | daftar tugas, lihat tugas | List tugas        |
| `guru_rekap`        | rekap, lihat rekap        | Rekap pengumpulan |
| `guru_status_tugas` | status tugas              | Detail status     |

---

## Deployment

### Web App (Vercel)

```bash
# Build & deploy otomatis via Git push
git push origin main

# Manual build
pnpm build
```

**Environment di Vercel:**

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `BOT_INTERNAL_URL` (https://bot.kinantiku.com)
- `BOT_SECRET`

### WhatsApp Bot (VPS/Local)

```bash
cd "bot kinanti"

# Install dependencies
pnpm install

# Generate Prisma
npx prisma generate

# Start bot + Cloudflare (2 terminal)
./start.sh

# Atau background mode
./start-bg.sh

# Stop
./stop.sh
```

### Cloudflare Tunnel

```yaml
# cloudflared/config.yml
tunnel: kinanti-bot
credentials-file: ~/.cloudflared/xxxxx.json

ingress:
  - hostname: bot.kinantiku.com
    service: http://localhost:4000
  - service: http_status:404
```

---

## Environment Variables

### Web App (`.env`)

```env
# Database
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_KEY="xxx"

# Auth
NEXTAUTH_SECRET="random-secret"
NEXTAUTH_URL="https://kinantiku.com"

# Bot Integration
BOT_INTERNAL_URL="https://bot.kinantiku.com"
BOT_SECRET="shared-secret-key"
```

### Bot (`.env`)

```env
# Database (same as web)
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_KEY="xxx"

# Bot Config
BOT_SECRET="shared-secret-key"
PORT=4000

# Environment
NODE_ENV=production
```

---

## Catatan Teknis

### Handling WhatsApp Linked Device (LID)

WhatsApp multi-device menggunakan Linked ID (`@lid`) bukan phone-based ID (`@c.us`). Solusi:

1. **Simpan mapping** saat user pertama kali chat
2. **Lookup mapping** saat broadcast
3. **Persist ke database** agar survive restart

```javascript
// PhoneJidMapping table
{ phone: "62895396334564", jid: "183154702835811@lid" }
```

### Safe Message Sending

Mengatasi bug `markedUnread` di whatsapp-web.js:

```javascript
async function safeSendMessage(client, phoneNumber, text) {
  // 1. Lookup JID mapping
  const jid = getJidByPhone(phoneNumber) || phoneNumber + "@c.us";

  // 2. Try pupPage.evaluate (bypass sendSeen)
  // 3. Fallback to client.sendMessage
  // 4. Ignore markedUnread errors
}
```

### Scheduled Tasks

```javascript
// scheduleController.js
// Reminder H-1 deadline setiap jam 8 pagi
cron.schedule("0 8 * * *", () => {
  // Cek tugas dengan deadline besok
  // Kirim reminder ke siswa yang belum kumpul
});
```

---

## Tim & Kontribusi

**Kinanti LMS** dikembangkan untuk memudahkan proses pembelajaran di SMK dengan pendekatan WhatsApp-first.

### Links

- **Web**: https://kinantiku.com
- **Bot**: https://bot.kinantiku.com
- **Repository**: https://github.com/rakategar/kinanti

---

_Dokumentasi ini dibuat pada Februari 2026_
