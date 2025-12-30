# Indikator Penilaian Otomatis pada Daftar Tugas Siswa

## Fitur Baru

Ketika siswa mengetik **"tugas saya"**, daftar tugas akan menampilkan indikator 🟢 untuk tugas yang akan dinilai secara otomatis.

## Kriteria

Tugas ditandai dengan 🟢 jika:

- Field `assignment.kunciJawaban` tidak null (berisi URL kunci jawaban)

## Tampilan

### Sebelum:

```
📚 *Daftar Tugas Kamu*

1. *MTK-001* — Latihan Aljabar
   Guru: Pak Budi | Deadline: 01/12/2025, 17.00
2. *IPA-002* — Laporan Praktikum
   Guru: Bu Ani | Deadline: 05/12/2025, 22.00
```

### Sesudah:

```
📚 *Daftar Tugas Kamu*

1. *MTK-001* 🟢 — Latihan Aljabar
   Guru: Pak Budi | Deadline: 01/12/2025, 17.00
2. *IPA-002* — Laporan Praktikum
   Guru: Bu Ani | Deadline: 05/12/2025, 22.00

🟢 = Dinilai otomatis
```

## File yang Diubah

- `src/controllers/siswaController.js` - Menambahkan logika indikator pada bagian "tugas saya"

## Testing

Jalankan test:

```bash
node test-tugas-indicator.js
```

## Implementasi

```javascript
const autoGradeIndicator = tg.kunciJawaban ? " 🟢" : "";
```

Indikator muncul tepat setelah kode tugas, sebelum dash (—) dan judul tugas.
