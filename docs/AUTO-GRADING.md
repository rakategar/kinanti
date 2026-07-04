# Penilaian Otomatis Tugas via WhatsApp Bot

## Overview

Fitur penilaian otomatis menggunakan AI (Google Gemini via n8n) untuk menilai tugas siswa yang memiliki kunci jawaban. Sistem akan otomatis mengirim hasil penilaian (grade, score, evaluasi) ke siswa via WhatsApp.

## Alur Kerja

### 1. Deteksi Tugas Dinilai Otomatis

```javascript
// Tugas dinilai otomatis jika assignment.kunciJawaban tidak null
const isAutoGraded = assignment?.kunciJawaban ? true : false;
```

### 2. Proses Pengumpulan

#### A. Tugas Manual (kunciJawaban = null)

```
Siswa: kumpul MTK-001
Bot: [kirim PDF]
Bot: 🎉 Tugas sukses terkumpul!
     📌 Kode: MTK-001
     📂 File: MTK-001_timestamp.pdf
     Mantap! 🚀
```

#### B. Tugas Otomatis (kunciJawaban != null)

```
Siswa: kumpul MTK-001
Bot: [kirim PDF]
Bot: 🎉 Tugas sukses terkumpul!
     📌 Kode: MTK-001
     📂 File: MTK-001_timestamp.pdf

     🤖 Tugas ini dinilai otomatis
     ⏳ Sedang diproses oleh AI... mohon tunggu sebentar.

[Sistem trigger webhook ke n8n]
[Polling hasil setiap 2 detik, max 30 detik]

Bot: 🎓 HASIL PENILAIAN OTOMATIS

     🌟 Grade: A
     📊 Score: 90/100

     💬 Evaluasi:
     Jawaban siswa sangat komprehensif...

     Semangat terus belajarnya! 🚀
```

### 3. Webhook Integration

#### Endpoint

```
POST http://0.0.0.0:5678/webhook/nilai-tugas
```

#### Request Payload

```json
{
  "id": 9, // AssignmentSubmission.id
  "siswaId": 3, // User.id (siswa)
  "tugasId": 12, // Assignment.id
  "pdfUrl": "https://...", // URL jawaban siswa
  "answerKeyUrl": "https://..." // URL kunci jawaban
}
```

#### Response Expected

n8n workflow akan:

1. Analyze document menggunakan Gemini AI
2. Parse JSON result
3. Update `AssignmentSubmission` dengan:
   - `evaluation` (String)
   - `grade` (A/B/C/D)
   - `score` (0-100)

### 4. Polling Mechanism

- Interval: 2 detik
- Timeout: 30 detik
- Cek field: `grade` dan `score` di `AssignmentSubmission`
- Jika timeout: Kirim notifikasi "Hasilnya akan diupdate nanti"

## Grade Conversion

| Score Range | Grade | Emoji |
| ----------- | ----- | ----- |
| 90 - 100    | A     | 🌟    |
| 80 - 89     | B     | ⭐    |
| 70 - 79     | C     | ✨    |
| 0 - 69      | D     | 💫    |

## File yang Dimodifikasi

### src/controllers/siswaController.js

Fungsi baru:

- `triggerAutoGrading()` - Kirim webhook ke n8n
- `pollGradingResult()` - Poll hasil penilaian dari DB

Fungsi dimodifikasi:

- `handleMediaWhilePending()` - Tambah logik deteksi & trigger auto-grading

## Environment Variables

Tambahkan ke `.env`:

```env
WEBHOOK_TUGAS_URL=http://0.0.0.0:5678/webhook/nilai-tugas
```

## n8n Workflow

Workflow terdiri dari 4 nodes:

1. **Webhook** - Terima POST request
2. **Analyze document (Gemini)** - Analisis PDF dengan AI
3. **Code (JavaScript)** - Parse & normalize hasil
4. **Update a row (Supabase)** - Update database

### Output dari Code Node

```json
{
  "id": 9,
  "siswaId": 3,
  "tugasId": 12,
  "pdfUrl": "https://...",
  "evaluation": "Jawaban siswa sangat komprehensif...",
  "grade": "A",
  "score": 90,
  "status": "SELESAI"
}
```

## Testing

### 1. Unit Test

```bash
node test-auto-grading.js
```

### 2. Manual Webhook Test

```bash
curl --location 'http://0.0.0.0:5678/webhook/nilai-tugas' \
--header 'Content-Type: application/json' \
--data '{
  "id": 9,
  "siswaId": 3,
  "tugasId": 12,
  "pdfUrl": "https://docs.google.com/document/d/...",
  "answerKeyUrl": "https://docs.google.com/document/d/..."
}'
```

### 3. End-to-End Test via WhatsApp

1. Buat tugas dengan kunci jawaban di web dashboard
2. Pastikan field `assignment.kunciJawaban` terisi
3. Via WhatsApp: `kumpul <KODE>`
4. Upload PDF tugas
5. Verifikasi:
   - Notifikasi "Tugas ini dinilai otomatis"
   - Hasil penilaian muncul dalam 30 detik

## Error Handling

### Webhook Gagal

```
⚠️ Gagal memproses penilaian otomatis. Guru akan menilai manual.
```

### Timeout (>30 detik)

```
⏱️ Penilaian memakan waktu lebih lama.
Hasilnya akan diupdate nanti ya!
Cek status tugas secara berkala.
```

## Database Schema Impact

### AssignmentSubmission

```prisma
model AssignmentSubmission {
  id         Int       @id @default(autoincrement())
  siswa      User      @relation(...)
  tugas      Assignment @relation(...)
  pdfUrl     String?
  evaluation String?   // <- Hasil evaluasi AI
  grade      String?   // <- Grade (A/B/C/D)
  score      Int?      // <- Score (0-100)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

### Assignment

```prisma
model Assignment {
  id           Int       @id @default(autoincrement())
  kode         String    @unique
  kunciJawaban String?   // <- Kunci jawaban URL (trigger auto-grading)
  // ... fields lain
}
```

## Monitoring & Logs

Log markers untuk debugging:

```
🤖 Triggering auto-grading for submission X...
✅ Webhook POST success: <URL>
✅ Grading result received for submission X
⏱️ Grading timeout for submission X
```

## Best Practices

1. **Timeout Setting**: 30 detik sudah cukup untuk kebanyakan dokumen. Adjust jika diperlukan.
2. **Polling Interval**: 2 detik balance antara responsiveness dan beban server.
3. **Error Notification**: Selalu inform siswa jika ada masalah, tapi jangan expose technical details.
4. **Webhook Async**: Gunakan fire-and-forget untuk webhook agar tidak block user experience.

## Future Improvements

1. WebSocket untuk real-time updates (eliminasi polling)
2. Retry mechanism untuk webhook failures
3. Queue system untuk batch grading
4. Admin dashboard untuk monitoring auto-grading status
5. Notification via email jika WhatsApp delivery gagal
