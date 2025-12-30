# 🚀 Deployment Checklist - Penilaian Otomatis Tugas

## Pre-Deployment

### 1. Code Review ✅

- [x] `src/controllers/siswaController.js` - Implementasi auto-grading
- [x] Fungsi `triggerAutoGrading()` - Webhook trigger
- [x] Fungsi `pollGradingResult()` - Polling mechanism
- [x] Error handling & timeout logic
- [x] Grade conversion (A/B/C/D)

### 2. Testing ✅

- [x] Unit test (`test-auto-grading.js`) - PASS
- [x] Payload format validation - OK
- [x] Notification format - OK
- [x] Grade conversion logic - OK

### 3. Documentation ✅

- [x] `docs/AUTO-GRADING.md` - Technical docs
- [x] `docs/AUTO-GRADING-FLOW.md` - Visual flow diagram
- [x] `IMPLEMENTATION-SUMMARY.md` - Summary
- [x] `.env.example` - Environment template

## Deployment Steps

### Step 1: Environment Setup

- [ ] Copy `.env.example` ke `.env` (jika belum ada)
- [ ] Set `WEBHOOK_TUGAS_URL=http://0.0.0.0:5678/webhook/nilai-tugas`
- [ ] Verifikasi `SUPABASE_URL` dan `SUPABASE_KEY`
- [ ] Verifikasi `DATABASE_URL`

### Step 2: n8n Workflow Setup

- [ ] Akses n8n di `http://0.0.0.0:5678`
- [ ] Import workflow JSON (ada di docs/AUTO-GRADING.md)
- [ ] Configure Gemini API credentials
- [ ] Configure Supabase credentials
- [ ] Test webhook endpoint: `curl -X POST http://0.0.0.0:5678/webhook/nilai-tugas`

### Step 3: Database Verification

- [ ] Cek schema `AssignmentSubmission` memiliki fields:
  - `evaluation String?`
  - `grade String?`
  - `score Int?`
- [ ] Cek schema `Assignment` memiliki field:
  - `kunciJawaban String?`

### Step 4: Server Restart

```bash
# Stop existing server
pkill -f "node.*server.js"

# Clean up stale locks
rm -rf /tmp/puppeteer_dev_chrome_profile-* /tmp/SingletonLock

# Start server
npm run server
```

### Step 5: Manual Testing

#### Test 1: Webhook (Manual)

```bash
curl --location 'http://0.0.0.0:5678/webhook/nilai-tugas' \
--header 'Content-Type: application/json' \
--data '{
  "id": 9,
  "siswaId": 3,
  "tugasId": 12,
  "pdfUrl": "https://docs.google.com/document/d/1ZWm1g6AX26se_tbCwFuzuOBC2q2DUdBUSaEPV1Sm2xg/edit?usp=sharing",
  "answerKeyUrl": "https://docs.google.com/document/d/1nOMa_pmnuEmSZMdoUY0ZxuIlwNVAwm1PXOsMByEio_A/edit?usp=sharing"
}'
```

**Expected:** HTTP 200, n8n logs menunjukkan workflow execution

#### Test 2: Database Update

```sql
-- Cek apakah submission #9 ter-update
SELECT id, grade, score, evaluation
FROM "AssignmentSubmission"
WHERE id = 9;
```

**Expected:** grade = 'A', score = 90, evaluation terisi

#### Test 3: WhatsApp End-to-End

1. **Setup:**

   - Buat tugas baru di dashboard
   - Upload kunci jawaban (pastikan `kunciJawaban` terisi)
   - Catat kode tugas (misal: MTK-001)

2. **Test Flow:**

   ```
   Siswa: tugas saya
   Bot:   [tampilkan daftar, MTK-001 ada 🟢]

   Siswa: kumpul MTK-001
   Bot:   [minta PDF]

   Siswa: [upload PDF]
   Bot:   🎉 Tugas sukses terkumpul!
          🤖 Tugas ini dinilai otomatis
          ⏳ Sedang diproses oleh AI...

   [tunggu max 30 detik]

   Bot:   🎓 HASIL PENILAIAN OTOMATIS
          🌟 Grade: A
          📊 Score: 90/100
          💬 Evaluasi: ...
   ```

3. **Verification:**
   - [ ] Notifikasi awal diterima
   - [ ] Notifikasi hasil diterima dalam 30 detik
   - [ ] Grade, score, evaluasi sesuai
   - [ ] Database ter-update

### Step 6: Monitoring

#### Logs to Watch

```bash
# Monitor server logs
tail -f /path/to/server.log | grep -E "🤖|✅|⏱️|❌"
```

**Key Log Markers:**

```
🤖 Triggering auto-grading for submission X...
✅ Webhook POST success: <URL>
✅ Grading result received for submission X
⏱️ Grading timeout for submission X
```

#### Health Checks

```bash
# Check n8n status
curl http://0.0.0.0:5678/healthz

# Check bot API status
curl http://localhost:4000/

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

## Post-Deployment

### Verification Checklist

- [ ] Server running without errors
- [ ] WhatsApp bot connected & ready
- [ ] n8n workflow active
- [ ] Manual webhook test successful
- [ ] Database updates working
- [ ] End-to-end WhatsApp test passed
- [ ] Logs showing correct flow

### Performance Monitoring

- [ ] Track average grading time (target: <30s)
- [ ] Monitor webhook success rate (target: >95%)
- [ ] Monitor timeout rate (target: <5%)
- [ ] Track user satisfaction (feedback dari siswa)

### Known Issues & Workarounds

#### Issue 1: Webhook Timeout

**Symptom:** Siswa dapat notifikasi timeout (>30s)
**Workaround:**

- Increase polling timeout di `siswaController.js`
- Optimize n8n workflow (cache Gemini responses)

#### Issue 2: PDF Not Accessible

**Symptom:** n8n gagal download PDF dari Supabase
**Workaround:**

- Pastikan bucket `submissions` public
- Cek CORS settings di Supabase

#### Issue 3: Gemini API Rate Limit

**Symptom:** Webhook error "Rate limit exceeded"
**Workaround:**

- Implement queue system
- Add retry with exponential backoff

## Rollback Plan

Jika ada masalah serius:

1. **Disable Auto-Grading:**

   ```bash
   # Comment out auto-grading logic
   # File: src/controllers/siswaController.js
   # Line: ~220-260 (triggerAutoGrading section)
   ```

2. **Revert to Manual Grading:**

   - Tugas tetap bisa dikumpulkan
   - Guru nilai manual via dashboard
   - Tidak ada notifikasi otomatis

3. **Restore from Backup:**
   ```bash
   git checkout <last-stable-commit>
   npm run server
   ```

## Success Metrics

### Week 1 (Soft Launch)

- [ ] 10+ tugas dinilai otomatis
- [ ] 0 critical errors
- [ ] <10% timeout rate
- [ ] Positive feedback dari 3+ siswa

### Month 1 (Full Launch)

- [ ] 100+ tugas dinilai otomatis
- [ ] 95%+ webhook success rate
- [ ] <5% timeout rate
- [ ] Average grading time <20s
- [ ] Guru report 50%+ time saved

## Support Contacts

- **Developer:** [Your contact]
- **n8n Admin:** [Admin contact]
- **Supabase Support:** [Support link]
- **Gemini API Issues:** [Google AI support]

---

**Last Updated:** 2025-11-27
**Status:** Ready for Deployment ✅
