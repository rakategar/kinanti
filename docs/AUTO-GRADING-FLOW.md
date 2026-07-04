# Flow Diagram: Penilaian Otomatis Tugas

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SISWA MENGUMPULKAN TUGAS                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Siswa: "kumpul MTK-001" │
                    └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Bot: "Kirim PDF-nya"    │
                    └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Siswa: [Upload PDF]     │
                    └─────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PROSES PENGUMPULAN                              │
│  1. Upload PDF ke Supabase                                          │
│  2. Simpan ke AssignmentSubmission                                  │
│  3. Update AssignmentStatus → SELESAI                               │
│  4. Cek assignment.kunciJawaban                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
                    ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │ kunciJawaban = null │      │ kunciJawaban != null│
        │   (Manual Grading)  │      │  (Auto Grading)     │
        └─────────────────────┘      └─────────────────────┘
                    │                            │
                    ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │ Bot: "Tugas sukses  │      │ Bot: "Tugas sukses  │
        │      terkumpul!"    │      │      terkumpul!     │
        │                     │      │ 🤖 Dinilai otomatis │
        │ ✅ SELESAI          │      │ ⏳ Mohon tunggu..."  │
        └─────────────────────┘      └─────────────────────┘
                                                 │
                                                 ▼
                                   ┌─────────────────────────┐
                                   │  Trigger Webhook (n8n)  │
                                   │  POST /webhook/nilai-   │
                                   │       tugas             │
                                   │                         │
                                   │  Payload:               │
                                   │  - submissionId         │
                                   │  - pdfUrl (siswa)       │
                                   │  - answerKeyUrl (guru)  │
                                   └─────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        N8N WORKFLOW                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐ │
│  │  Webhook    │──▶│ Gemini AI    │──▶│   Code   │──▶│ Update   │ │
│  │  Receive    │   │ Analyze Docs │   │  Parse   │   │ Database │ │
│  └─────────────┘   └──────────────┘   └──────────┘   └──────────┘ │
│                                                                     │
│  Output:                                                            │
│  - evaluation: "Jawaban siswa komprehensif..."                     │
│  - grade: "A"                                                       │
│  - score: 90                                                        │
└─────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                                   ┌─────────────────────────┐
                                   │   Polling (2s interval) │
                                   │   Max 30 detik          │
                                   │                         │
                                   │   Cek DB: grade & score │
                                   │   sudah ada?            │
                                   └─────────────────────────┘
                                                 │
                                   ┌─────────────┴──────────────┐
                                   │                            │
                                   ▼                            ▼
                         ┌──────────────────┐       ┌──────────────────┐
                         │ Hasil Ada        │       │ Timeout (>30s)   │
                         │ (grade != null)  │       │ (grade = null)   │
                         └──────────────────┘       └──────────────────┘
                                   │                            │
                                   ▼                            ▼
                   ┌──────────────────────────┐   ┌─────────────────────┐
                   │ Bot: "🎓 HASIL PENILAIAN"│   │ Bot: "⏱️ Penilaian  │
                   │                          │   │ memakan waktu lama."│
                   │ 🌟 Grade: A              │   │ Hasilnya akan       │
                   │ 📊 Score: 90/100         │   │ diupdate nanti ya!" │
                   │                          │   └─────────────────────┘
                   │ 💬 Evaluasi:             │              │
                   │ Jawaban komprehensif...  │              │
                   │                          │              ▼
                   │ Semangat terus! 🚀       │   ┌─────────────────────┐
                   └──────────────────────────┘   │ Siswa cek berkala   │
                                   │               │ "status tugas"      │
                                   ▼               └─────────────────────┘
                         ┌──────────────────┐
                         │  ✅ SELESAI      │
                         │  (Siswa ternotif)│
                         └──────────────────┘
```

## Legend

- **Manual Grading** (kunci jawaban tidak ada):
  - Tugas disimpan
  - Guru menilai manual via web dashboard
- **Auto Grading** (kunci jawaban ada):
  - Tugas disimpan
  - Webhook ke n8n
  - AI (Gemini) analisis
  - Hasil otomatis kembali ke siswa

## Emoji Grade System

| Grade | Score    | Emoji |
| ----- | -------- | ----- |
| A     | 90 - 100 | 🌟    |
| B     | 80 - 89  | ⭐    |
| C     | 70 - 79  | ✨    |
| D     | 0 - 69   | 💫    |

## Timing

- **Upload**: ~2-5 detik (tergantung ukuran PDF)
- **Webhook trigger**: ~1 detik
- **AI Analysis**: ~10-20 detik (Gemini processing)
- **Polling interval**: 2 detik
- **Total (best case)**: ~15-30 detik dari upload sampai notifikasi hasil
- **Timeout**: 30 detik (siswa diberi tahu untuk cek berkala)
