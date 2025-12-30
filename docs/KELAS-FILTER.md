# Filter Kelas pada Fitur "Tugas Saya"

## Problem

Sebelumnya, ketika siswa mengetik **"tugas saya"**, sistem menampilkan SEMUA tugas yang ter-assign ke siswa tersebut, termasuk tugas dari kelas lain yang tidak sesuai dengan kelas siswa.

**Contoh masalah:**

- Siswa A kelas XIITKJ1 mendapat tugas untuk kelas XITKJ2
- Siswa B kelas XITKJ2 melihat tugas untuk kelas XIITKJ1

## Solution

Menambahkan filter kelas pada 3 fungsi utama di `siswaController.js`:

### 1. `getStudentBySender()`

Sekarang menyertakan field `kelas` saat query siswa:

```javascript
select: { id: true, nama: true, phone: true, kelas: true }
```

### 2. `listOpenAssignments()`

Filter tugas BELUM_SELESAI berdasarkan kelas siswa:

```javascript
if (student.kelas) {
  const studentKelas = String(student.kelas);
  return items.filter((item) => {
    const tugasKelas = String(item.tugas.kelas || "");
    return tugasKelas === studentKelas;
  });
}
```

### 3. `listDoneAssignments()`

Filter tugas SELESAI berdasarkan kelas siswa (konsisten dengan open assignments)

### 4. `findAssignmentForStudentByKode()`

Validasi kelas saat siswa mencari tugas by kode (detail, kumpul):

```javascript
if (student.kelas) {
  const studentKelas = String(student.kelas);
  const tugasKelas = String(asg.kelas || "");
  if (tugasKelas !== studentKelas) {
    console.log(`⚠️ Tugas ${kode} tidak sesuai kelas`);
    return null;
  }
}
```

## Behavior

### Siswa dengan Kelas (Normal Case)

```
Siswa: kelas = XIITKJ1
Tugas di DB:
  - MTK-001 (kelas: XIITKJ1) ✅ Muncul
  - IPA-002 (kelas: XITKJ2)  ❌ Tidak muncul
  - BHS-003 (kelas: XIITKJ1) ✅ Muncul
```

### Siswa tanpa Kelas (Fallback)

```
Siswa: kelas = null
Behavior: Tampilkan semua tugas (backward compatibility)
```

## Testing

### Unit Test

```bash
node test-kelas-filter.js
```

**Test Coverage:**

- ✅ Siswa XIITKJ1 hanya lihat tugas kelas XIITKJ1
- ✅ Siswa XITKJ2 hanya lihat tugas kelas XITKJ2
- ✅ Siswa tanpa kelas melihat semua (fallback)
- ✅ Tugas kelas lain tidak bocor ke siswa kelas berbeda

### Manual Test via WhatsApp

#### Setup:

1. Buat 2 siswa dengan kelas berbeda (XIITKJ1, XITKJ2)
2. Buat tugas untuk masing-masing kelas
3. Assign tugas ke siswa via `AssignmentStatus`

#### Test Flow:

```
Siswa XIITKJ1: "tugas saya"
Expected: Hanya tugas kelas XIITKJ1

Siswa XITKJ2: "tugas saya"
Expected: Hanya tugas kelas XITKJ2

Siswa XIITKJ1: "kumpul IPA-002" (tugas kelas XITKJ2)
Expected: "😕 Tugas dengan kode IPA-002 ga ketemu."
```

## Impact on Other Features

### ✅ Tidak Berpengaruh:

- Auto-grading (tetap berjalan normal)
- Upload PDF (tetap berjalan normal)
- Notifikasi hasil penilaian (tetap berjalan normal)

### ✅ Konsisten di Semua Intent:

- `siswa_list_tugas` (tugas saya)
- `siswa_status_tugas` (riwayat)
- `siswa_detail_tugas` (detail <KODE>)
- `siswa_kumpul_tugas` (kumpul <KODE>)

## Database Schema

### User

```prisma
model User {
  kelas Kelas?  // Enum: XTKJ1, XTKJ2, XITKJ1, dll.
}
```

### Assignment

```prisma
model Assignment {
  kelas String  // String: "XIITKJ1", "XITKJ2", dll.
}
```

**Note:** User.kelas adalah Enum, Assignment.kelas adalah String. Filter menggunakan `String()` untuk normalisasi.

## Logging

Ketika siswa mencoba akses tugas kelas lain:

```
⚠️ Tugas IPA-002 tidak sesuai kelas. Siswa: XIITKJ1, Tugas: XITKJ2
```

## Edge Cases

### 1. Siswa Pindah Kelas

**Problem:** Siswa awalnya XITKJ1, pindah ke XIITKJ1  
**Solution:** Update `User.kelas` di database, filter otomatis menyesuaikan

### 2. Tugas Multi-Kelas

**Problem:** Guru ingin assign 1 tugas ke beberapa kelas  
**Current Limitation:** Tidak didukung (1 assignment = 1 kelas)  
**Workaround:** Buat tugas terpisah per kelas (MTK-001-XIITKJ1, MTK-001-XITKJ2)

### 3. Kelas String vs Enum

**Problem:** Assignment.kelas (String) vs User.kelas (Enum)  
**Solution:** Normalisasi dengan `String()` di filter

## Migration Guide

Jika ada data existing yang salah:

### Query: Cek siswa yang punya tugas kelas lain

```sql
SELECT
  u.id as siswa_id,
  u.nama,
  u.kelas as siswa_kelas,
  a.kode,
  a.kelas as tugas_kelas
FROM "AssignmentStatus" ast
JOIN "User" u ON ast."siswaId" = u.id
JOIN "Assignment" a ON ast."tugasId" = a.id
WHERE u.kelas::text != a.kelas
  AND u.kelas IS NOT NULL;
```

### Fix: Hapus assignment status yang salah kelas

```sql
DELETE FROM "AssignmentStatus"
WHERE id IN (
  SELECT ast.id
  FROM "AssignmentStatus" ast
  JOIN "User" u ON ast."siswaId" = u.id
  JOIN "Assignment" a ON ast."tugasId" = a.id
  WHERE u.kelas::text != a.kelas
    AND u.kelas IS NOT NULL
);
```

## Performance

**Impact:** Minimal

- Filter di application layer (setelah query)
- Array filtering O(n) dimana n = jumlah tugas per siswa (biasanya <50)
- Tidak menambah database query

**Alternative (Future):** Filter di database query untuk performance optimal:

```javascript
where: {
  siswaId: student.id,
  status: "BELUM_SELESAI",
  tugas: { kelas: String(student.kelas) }
}
```

## Summary

✅ **Fixed:** Siswa hanya melihat tugas sesuai kelasnya  
✅ **Backward Compatible:** Siswa tanpa kelas tetap bisa akses  
✅ **Tested:** Unit test dan manual test passed  
✅ **Consistent:** Filter applied ke semua fitur tugas  
✅ **Documented:** Lengkap dengan test dan troubleshooting guide

---

**Last Updated:** 2025-11-27  
**Status:** ✅ Implemented & Tested
