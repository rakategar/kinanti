# 🔧 Troubleshooting Guide - Penilaian Otomatis

## Quick Diagnostics

### Problem: Siswa tidak dapat notifikasi hasil penilaian

#### Checklist

1. **Cek webhook berhasil trigger?**

   ```bash
   # Lihat log server
   grep "Triggering auto-grading" /path/to/server.log
   grep "Webhook POST success" /path/to/server.log
   ```

   - ✅ Ada log: Webhook triggered
   - ❌ Tidak ada: Bug di `triggerAutoGrading()`

2. **Cek n8n workflow running?**

   ```bash
   curl http://0.0.0.0:5678/webhook/nilai-tugas
   ```

   - ✅ HTTP 200: Workflow aktif
   - ❌ Connection refused: n8n down
   - ❌ 404: Webhook path salah

3. **Cek database ter-update?**

   ```sql
   SELECT id, grade, score, evaluation, "updatedAt"
   FROM "AssignmentSubmission"
   WHERE id = <submission_id>
   ORDER BY "updatedAt" DESC;
   ```

   - ✅ grade & score terisi: Database OK
   - ❌ Masih null: n8n tidak update

4. **Cek polling timeout?**
   ```bash
   grep "Grading timeout" /path/to/server.log
   ```
   - ✅ Ada log: Timeout (>30s)
   - ❌ Tidak ada: Polling error

---

## Common Issues

### Issue 1: "⚠️ Gagal memproses penilaian otomatis"

**Cause:** Webhook POST gagal

**Debug Steps:**

```bash
# Test webhook manual
curl --location 'http://0.0.0.0:5678/webhook/nilai-tugas' \
--header 'Content-Type: application/json' \
--data '{"id":9,"siswaId":3,"tugasId":12,"pdfUrl":"https://...","answerKeyUrl":"https://..."}'
```

**Solutions:**

1. Pastikan n8n running: `docker ps | grep n8n` atau `pm2 list | grep n8n`
2. Cek WEBHOOK_TUGAS_URL di `.env`
3. Cek firewall/network: `telnet 0.0.0.0 5678`

---

### Issue 2: "⏱️ Penilaian memakan waktu lebih lama"

**Cause:** Polling timeout (>30s), hasil belum ada di database

**Debug Steps:**

```sql
-- Cek status submission
SELECT
  id,
  "siswaId",
  "tugasId",
  grade,
  score,
  "updatedAt"
FROM "AssignmentSubmission"
WHERE id = <submission_id>;
```

**Solutions:**

1. **Jika grade/score null:** n8n workflow stuck

   - Cek n8n execution logs
   - Cek Gemini API quota
   - Cek PDF URL accessible

2. **Jika grade/score ada (tapi siswa belum dapat notif):**
   - Polling timeout terlalu pendek
   - Increase timeout di `siswaController.js`:
     ```javascript
     await pollGradingResult(submissionId, message, 60); // 30 → 60 detik
     ```

---

### Issue 3: n8n Workflow Error

**Cause:** Gemini API error, Supabase error, atau parsing error

**Debug Steps:**

1. Akses n8n dashboard: `http://0.0.0.0:5678`
2. Lihat execution history
3. Cek error di node mana

**Common Errors:**

#### Error: "API key not valid"

```
Solution: Configure Gemini API credentials
Settings → Credentials → Google Gemini (PaLM) API
```

#### Error: "Invalid PDF URL"

```
Solution: Pastikan Supabase bucket "submissions" public
Supabase Dashboard → Storage → submissions → Make public
```

#### Error: "JSON parse failed"

```
Solution: Gemini output format salah
- Cek prompt di node "Analyze document"
- Pastikan prompt minta "HANYA JSON, TANPA MARKDOWN"
```

---

### Issue 4: Grade Tidak Sesuai

**Cause:** n8n Code node logic salah

**Debug Steps:**

```javascript
// Cek output Gemini (di n8n execution log)
// Pastikan format JSON:
{
  "score": 90,
  "grade": "A",
  "topic_check": "...",
  "matchConfidence": 0.95,
  "summary": "..."
}
```

**Solutions:**

1. Verifikasi grade conversion logic di Code node:

   ```javascript
   if (score >= 90) grade = "A";
   else if (score >= 80) grade = "B";
   else if (score >= 70) grade = "C";
   else grade = "D";
   ```

2. Pastikan Supabase Update node mapping correct:
   - `evaluation` ← `summary`
   - `grade` ← `grade`
   - `score` ← `score`

---

### Issue 5: Database Not Updated

**Cause:** Supabase credentials salah atau permissions issue

**Debug Steps:**

```bash
# Test Supabase connection
curl '<SUPABASE_URL>/rest/v1/AssignmentSubmission?id=eq.9' \
  -H "apikey: <SUPABASE_KEY>" \
  -H "Authorization: Bearer <SUPABASE_KEY>"
```

**Solutions:**

1. Verifikasi Supabase credentials di n8n
2. Cek RLS (Row Level Security) policies:
   - Supabase Dashboard → Authentication → Policies
   - Pastikan `AssignmentSubmission` table accessible

---

## Performance Issues

### Issue: Grading Lambat (>30s)

**Diagnosis:**

```bash
# Timing breakdown:
# - Upload PDF: 2-5s
# - Webhook trigger: 1s
# - Gemini processing: 10-20s (bottleneck)
# - Database update: 1s
# - Polling: 2-4s
```

**Solutions:**

#### 1. Optimize Gemini Processing

- Reduce prompt length
- Use smaller PDF (compress sebelum upload)
- Use faster Gemini model (e.g., `gemini-1.5-flash`)

#### 2. Increase Timeout

```javascript
// File: src/controllers/siswaController.js
// Line: ~260
await pollGradingResult(submissionId, message, 60); // 30 → 60 detik
```

#### 3. Async Notification (No Polling)

```javascript
// Alternative: Webhook callback dari n8n ke bot
// n8n workflow tambah node "Send WhatsApp Message"
// Eliminasi polling, siswa dapat notif langsung
```

---

## Monitoring Commands

### Real-time Logs

```bash
# Monitor auto-grading activities
tail -f /path/to/server.log | grep -E "🤖|✅|⏱️"
```

### Statistics Query

```sql
-- Auto-graded submissions per hari
SELECT
  DATE("updatedAt") as date,
  COUNT(*) as total,
  AVG(score) as avg_score,
  COUNT(CASE WHEN grade = 'A' THEN 1 END) as grade_a,
  COUNT(CASE WHEN grade = 'B' THEN 1 END) as grade_b,
  COUNT(CASE WHEN grade = 'C' THEN 1 END) as grade_c,
  COUNT(CASE WHEN grade = 'D' THEN 1 END) as grade_d
FROM "AssignmentSubmission"
WHERE grade IS NOT NULL
  AND "updatedAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("updatedAt")
ORDER BY date DESC;
```

### Success Rate

```sql
-- Webhook success rate
SELECT
  COUNT(*) FILTER (WHERE grade IS NOT NULL) as success,
  COUNT(*) FILTER (WHERE grade IS NULL) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE grade IS NOT NULL) / COUNT(*), 2) as success_rate
FROM "AssignmentSubmission"
WHERE "createdAt" >= NOW() - INTERVAL '24 hours';
```

---

## Emergency Actions

### 1. Disable Auto-Grading (Temporary)

```javascript
// File: src/controllers/siswaController.js
// Line: ~220, comment out:
/*
const isAutoGraded = assignment?.kunciJawaban ? true : false;
if (isAutoGraded) {
  // ... auto-grading logic
}
*/

// Replace with:
const isAutoGraded = false; // Force disable
```

### 2. Manual Grading Fallback

```sql
-- Siswa yang belum dinilai otomatis
SELECT
  s.id as submission_id,
  u.nama as siswa_nama,
  a.kode as tugas_kode,
  s."pdfUrl"
FROM "AssignmentSubmission" s
JOIN "User" u ON s."siswaId" = u.id
JOIN "Assignment" a ON s."tugasId" = a.id
WHERE s.grade IS NULL
  AND a."kunciJawaban" IS NOT NULL
ORDER BY s."createdAt" DESC;
```

### 3. Retry Failed Grading

```bash
# Script untuk retry
for id in $(psql $DATABASE_URL -t -c "SELECT id FROM \"AssignmentSubmission\" WHERE grade IS NULL AND \"createdAt\" >= NOW() - INTERVAL '1 day'"); do
  curl --location 'http://0.0.0.0:5678/webhook/nilai-tugas' \
    --header 'Content-Type: application/json' \
    --data "{\"id\":$id, ...}"
  sleep 2
done
```

---

## Contact & Escalation

| Issue Type       | First Response    | Escalation             |
| ---------------- | ----------------- | ---------------------- |
| Bot down         | Restart server    | Check infrastructure   |
| n8n down         | Restart n8n       | Check Docker/PM2       |
| Database issue   | Check connections | Contact DBA            |
| Gemini API issue | Check quota       | Contact Google Support |
| High error rate  | Check logs        | Rollback deployment    |

---

**Last Updated:** 2025-11-27  
**Maintainer:** Development Team
