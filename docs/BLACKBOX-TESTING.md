# 🧪 Blackbox Testing - Kinanti LMS

**Versi:** 1.0  
**Tanggal:** 7 Februari 2026  
**Penguji:** ********\_********  
**URL Web:** https://kinantiku.com  
**Metode:** Blackbox Testing (Equivalence Partitioning & Boundary Value Analysis)

---

## 📋 Daftar Isi

1. [Modul Registrasi](#1-modul-registrasi)
2. [Modul Login](#2-modul-login)
3. [Modul Dashboard Siswa](#3-modul-dashboard-siswa)
4. [Modul Pengumpulan Tugas Siswa](#4-modul-pengumpulan-tugas-siswa)
5. [Modul Dashboard Guru](#5-modul-dashboard-guru)
6. [Modul Buat Tugas (Guru)](#6-modul-buat-tugas-guru)
7. [Modul Rekap Tugas (Guru)](#7-modul-rekap-tugas-guru)
8. [Modul Broadcast (Guru)](#8-modul-broadcast-guru)
9. [Modul Penilaian (Guru)](#9-modul-penilaian-guru)
10. [Modul Assessment / Ujian (Guru)](#10-modul-assessment--ujian-guru)
11. [Modul Middleware & Otorisasi](#11-modul-middleware--otorisasi)
12. [Modul Logout](#12-modul-logout)
13. [Ringkasan Hasil](#ringkasan-hasil)

---

## 1. Modul Registrasi

**Halaman:** `/register`

| No   | Skenario Pengujian                         | Input                                                                               | Hasil yang Diharapkan                                                                            | Hasil Aktual | Status |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------ | ------ |
| R-01 | Registrasi dengan data valid               | Nama: "Budi Santoso", Phone: "6289539633456", Password: "password123", Kelas: XTKJ1 | Muncul konfirmasi data, setelah klik "Daftar" → registrasi berhasil, auto-login, redirect ke `/` |              | ☐      |
| R-02 | Registrasi dengan nomor HP format 08       | Phone: "089539633456"                                                               | Muncul warning "Nomor HP harus diawali dengan 62"                                                |              | ☐      |
| R-03 | Registrasi dengan nomor HP sudah terdaftar | Phone: nomor HP yang sudah ada di database                                          | Muncul error "Nomor WhatsApp sudah terdaftar"                                                    |              | ☐      |
| R-04 | Registrasi tanpa mengisi nama              | Nama: (kosong), field lain terisi                                                   | Muncul validasi form HTML (required)                                                             |              | ☐      |
| R-05 | Registrasi tanpa mengisi password          | Password: (kosong), field lain terisi                                               | Muncul validasi form HTML (required)                                                             |              | ☐      |
| R-06 | Registrasi tanpa memilih kelas             | Kelas: (tidak dipilih), field lain terisi                                           | Muncul error kelas tidak valid                                                                   |              | ☐      |
| R-07 | Registrasi dengan kelas tidak valid        | Kelas: "XTKJ99" (manipulasi)                                                        | API menolak dengan error "Kelas tidak valid" (400)                                               |              | ☐      |
| R-08 | Klik "Batal" pada dialog konfirmasi        | Isi semua data → muncul konfirmasi → klik "Batal"                                   | Kembali ke form, data masih ada, tidak dikirim ke server                                         |              | ☐      |
| R-09 | Klik link "Login di sini"                  | Klik link login di bawah form                                                       | Redirect ke halaman `/login`                                                                     |              | ☐      |
| R-10 | Nomor HP kurang dari 10 digit              | Phone: "62893"                                                                      | Muncul warning validasi nomor HP                                                                 |              | ☐      |

---

## 2. Modul Login

**Halaman:** `/login`

| No   | Skenario Pengujian                            | Input                                           | Hasil yang Diharapkan                                                                          | Hasil Aktual | Status |
| ---- | --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ | ------ |
| L-01 | Login siswa dengan data valid                 | Phone: "6289539633456", Password: "password123" | Tombol disabled → muncul "Memproses..." → muncul alert "Login Berhasil!" → redirect ke `/`     |              | ☐      |
| L-02 | Login guru dengan data valid                  | Phone: nomor guru, Password: password guru      | Tombol disabled → muncul "Memproses..." → muncul alert "Login Berhasil!" → redirect ke `/guru` |              | ☐      |
| L-03 | Login dengan nomor HP salah                   | Phone: "6200000000000", Password: "password123" | Muncul alert "Nomor HP atau Password Salah" → tombol kembali aktif                             |              | ☐      |
| L-04 | Login dengan password salah                   | Phone: nomor valid, Password: "salah123"        | Muncul alert "Nomor HP atau Password Salah" → tombol kembali aktif                             |              | ☐      |
| L-05 | Login dengan nomor HP kosong                  | Phone: (kosong), Password: "password123"        | Muncul alert "Nomor HP Tidak Valid" → tombol kembali aktif                                     |              | ☐      |
| L-06 | Login dengan password kosong                  | Phone: "6289539633456", Password: (kosong)      | Muncul alert "Password Kosong" → tombol kembali aktif                                          |              | ☐      |
| L-07 | Login dengan format 08                        | Phone: "089539633456", Password: "password123"  | Nomor otomatis di-normalize ke 6289539633456, login berhasil                                   |              | ☐      |
| L-08 | Double-click tombol login                     | Klik tombol login cepat 2x                      | Hanya 1 request yang dikirim, tombol disabled setelah klik pertama                             |              | ☐      |
| L-09 | Tombol disable saat proses login              | Isi data lalu klik Login                        | Input field dan tombol menjadi disabled, muncul spinner "Memproses..."                         |              | ☐      |
| L-10 | Tombol tetap disabled saat redirect           | Login berhasil                                  | Tombol tetap disabled dengan text "Mengalihkan...", tidak kembali aktif                        |              | ☐      |
| L-11 | Akses `/login` saat sudah login sebagai siswa | Sudah login siswa → buka `/login`               | Auto-redirect ke `/`                                                                           |              | ☐      |
| L-12 | Akses `/login` saat sudah login sebagai guru  | Sudah login guru → buka `/login`                | Auto-redirect ke `/guru`                                                                       |              | ☐      |
| L-13 | Klik link "Daftar di sini"                    | Klik link register di bawah form                | Redirect ke halaman `/register`                                                                |              | ☐      |

---

## 3. Modul Dashboard Siswa

**Halaman:** `/` (root)

| No    | Skenario Pengujian                     | Input                                                  | Hasil yang Diharapkan                                                       | Hasil Aktual | Status |
| ----- | -------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | ------------ | ------ |
| DS-01 | Tampilan dashboard siswa setelah login | Login sebagai siswa                                    | Tampil nama siswa, daftar tugas sesuai kelasnya, confetti saat pertama kali |              | ☐      |
| DS-02 | Daftar tugas sesuai kelas siswa        | Login siswa kelas XTKJ1                                | Hanya tampil tugas yang ditujukan untuk kelas XTKJ1                         |              | ☐      |
| DS-03 | Status tugas "BELUM_SELESAI"           | Siswa belum mengumpulkan tugas                         | Tugas menampilkan status "Belum Selesai"                                    |              | ☐      |
| DS-04 | Status tugas "SELESAI"                 | Siswa sudah mengumpulkan tugas                         | Tugas menampilkan status "Selesai"                                          |              | ☐      |
| DS-05 | Filter/pencarian tugas                 | Ketik kode tugas atau judul di kolom pencarian         | Daftar tugas terfilter sesuai keyword                                       |              | ☐      |
| DS-06 | Pencarian tidak ditemukan              | Ketik keyword yang tidak ada                           | Daftar tugas kosong / tidak ada yang ditampilkan                            |              | ☐      |
| DS-07 | Confetti hanya muncul sekali           | Login pertama kali → confetti muncul → refresh halaman | Confetti hanya muncul sekali (localStorage check)                           |              | ☐      |
| DS-08 | Dashboard tanpa tugas                  | Siswa di kelas yang belum ada tugas                    | Tampil pesan kosong / tabel kosong                                          |              | ☐      |

---

## 4. Modul Pengumpulan Tugas Siswa

**API:** `POST /api/upload-tugas`

| No    | Skenario Pengujian                          | Input                                            | Hasil yang Diharapkan                                               | Hasil Aktual | Status |
| ----- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | ------------ | ------ |
| PT-01 | Upload tugas PDF valid                      | File: tugas.pdf (valid), userId, tugasId         | Upload berhasil, file tersimpan di Supabase, status tugas → SELESAI |              | ☐      |
| PT-02 | Upload file bukan PDF                       | File: tugas.docx atau gambar.png                 | Muncul error "Hanya file PDF yang diperbolehkan" (415)              |              | ☐      |
| PT-03 | Upload tanpa file                           | Tidak ada file yang dipilih                      | Muncul error "Data tidak lengkap" (400)                             |              | ☐      |
| PT-04 | Upload dengan userId tidak valid            | userId: "abc"                                    | Muncul error "Data tidak lengkap" (400)                             |              | ☐      |
| PT-05 | Upload dengan tugasId tidak ada di database | tugasId: 99999                                   | Muncul error "Tugas tidak ditemukan" (404)                          |              | ☐      |
| PT-06 | Upload ulang (re-submit)                    | Siswa upload tugas yang sudah pernah dikumpulkan | Upload berhasil, submission terbaru menggantikan yang lama          |              | ☐      |

---

## 5. Modul Dashboard Guru

**Halaman:** `/guru`

| No    | Skenario Pengujian                       | Input                            | Hasil yang Diharapkan                                     | Hasil Aktual | Status |
| ----- | ---------------------------------------- | -------------------------------- | --------------------------------------------------------- | ------------ | ------ |
| DG-01 | Tampilan dashboard guru setelah login    | Login sebagai guru               | Tampil daftar tugas milik guru tersebut, tabel assessment |              | ☐      |
| DG-02 | Daftar tugas hanya milik guru yang login | Login guru A                     | Hanya tampil tugas yang dibuat oleh guru A                |              | ☐      |
| DG-03 | Tombol "Buat Tugas"                      | Klik tombol buat tugas           | Modal form pembuatan tugas terbuka                        |              | ☐      |
| DG-04 | Tombol "Refresh"                         | Klik tombol refresh              | Data tugas dimuat ulang dari server                       |              | ☐      |
| DG-05 | Pencarian tugas guru                     | Ketik keyword di kolom pencarian | Daftar tugas terfilter sesuai keyword                     |              | ☐      |
| DG-06 | Dashboard guru tanpa tugas               | Guru baru belum buat tugas       | Tampil tabel kosong dengan pesan yang sesuai              |              | ☐      |
| DG-07 | Redirect otomatis jika belum login       | Akses `/guru` tanpa session      | Redirect ke `/login`                                      |              | ☐      |

---

## 6. Modul Buat Tugas (Guru)

**API:** `POST /api/guru/create-assignment`

| No    | Skenario Pengujian                    | Input                                                                                | Hasil yang Diharapkan                                   | Hasil Aktual | Status |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------ | ------ |
| BT-01 | Buat tugas dengan semua data valid    | Kode: "TGS001", Judul: "Tugas 1", Deskripsi: "...", Kelas: "XTKJ1", Deadline: 3 hari | Tugas berhasil dibuat, muncul di daftar tugas           |              | ☐      |
| BT-02 | Buat tugas dengan lampiran PDF        | Data valid + upload file PDF                                                         | Tugas dibuat, PDF ter-upload ke Supabase, URL tersimpan |              | ☐      |
| BT-03 | Buat tugas tanpa lampiran PDF         | Data valid tanpa file                                                                | Tugas dibuat tanpa pdfUrl                               |              | ☐      |
| BT-04 | Buat tugas dengan kode yang sudah ada | Kode: kode yang sudah dipakai guru ini                                               | Muncul error "Kode sudah dipakai" (409)                 |              | ☐      |
| BT-05 | Buat tugas tanpa kode                 | Kode: (kosong)                                                                       | Muncul error "Kode, Judul, dan Kelas wajib diisi" (400) |              | ☐      |
| BT-06 | Buat tugas tanpa judul                | Judul: (kosong)                                                                      | Muncul error "Kode, Judul, dan Kelas wajib diisi" (400) |              | ☐      |
| BT-07 | Buat tugas tanpa kelas                | Kelas: (kosong)                                                                      | Muncul error "Kode, Judul, dan Kelas wajib diisi" (400) |              | ☐      |
| BT-08 | Buat tugas tanpa deadline             | Deadline: (kosong)                                                                   | Tugas berhasil dibuat dengan deadline null              |              | ☐      |
| BT-09 | Cek ketersediaan kode                 | Kode: "XYZABC" (belum ada)                                                           | API return `{ available: true }`                        |              | ☐      |
| BT-10 | Cek kode yang sudah terpakai          | Kode: kode yang sudah ada                                                            | API return `{ available: false }`                       |              | ☐      |

---

## 7. Modul Rekap Tugas (Guru)

**API:** `POST /api/guru/rekap`

| No    | Skenario Pengujian                   | Input                                | Hasil yang Diharapkan                                        | Hasil Aktual | Status |
| ----- | ------------------------------------ | ------------------------------------ | ------------------------------------------------------------ | ------------ | ------ |
| RK-01 | Lihat rekap tugas valid              | Kode: "TGS001", Kelas: "XTKJ1"       | Tampil daftar siswa beserta status pengumpulan (sudah/belum) |              | ☐      |
| RK-02 | Rekap dengan kode tidak ditemukan    | Kode: "ZZZZZ", Kelas: "XTKJ1"        | Muncul error "Tugas tidak ditemukan" (404)                   |              | ☐      |
| RK-03 | Rekap tanpa kode                     | Kode: (kosong)                       | Muncul error "Kode dan Kelas wajib diisi" (400)              |              | ☐      |
| RK-04 | Rekap tanpa kelas                    | Kelas: (kosong)                      | Muncul error "Kode dan Kelas wajib diisi" (400)              |              | ☐      |
| RK-05 | Rekap kelas tanpa siswa              | Kode valid, Kelas: kelas tanpa siswa | Tampil tabel kosong, tidak error                             |              | ☐      |
| RK-06 | Download rekap Excel                 | Klik tombol download Excel di rekap  | File Excel berhasil didownload dengan data siswa yang benar  |              | ☐      |
| RK-07 | Rekap menampilkan submission terbaru | Siswa submit ulang                   | Rekap menunjukkan data submission paling baru                |              | ☐      |

---

## 8. Modul Broadcast (Guru)

**API:** `POST /api/guru/broadcast`

| No    | Skenario Pengujian                   | Input                                | Hasil yang Diharapkan                                  | Hasil Aktual | Status |
| ----- | ------------------------------------ | ------------------------------------ | ------------------------------------------------------ | ------------ | ------ |
| BC-01 | Broadcast tugas ke kelas valid       | Kode: "TGS001", Kelas: "XTKJ1"       | Pesan terkirim ke semua siswa kelas XTKJ1 via WhatsApp |              | ☐      |
| BC-02 | Broadcast tanpa kode                 | Kode: (kosong)                       | Muncul error "Kode dan Kelas wajib diisi" (400)        |              | ☐      |
| BC-03 | Broadcast tanpa kelas                | Kelas: (kosong)                      | Muncul error "Kode dan Kelas wajib diisi" (400)        |              | ☐      |
| BC-04 | Broadcast tugas yang tidak ada       | Kode: "ZZZZZ", Kelas: "XTKJ1"        | Muncul error "Tugas tidak ditemukan" (404)             |              | ☐      |
| BC-05 | Broadcast ke kelas tanpa siswa       | Kode valid, Kelas: kelas tanpa siswa | Broadcast diproses tapi 0 pesan terkirim               |              | ☐      |
| BC-06 | Broadcast saat bot tidak aktif       | Bot WhatsApp mati/offline            | Muncul error "Gagal kirim ke bot" (500)                |              | ☐      |
| BC-07 | Tombol broadcast disable saat proses | Klik broadcast                       | Tombol menjadi disabled dan ada indikator loading      |              | ☐      |

---

## 9. Modul Penilaian (Guru)

**API:** `GET /api/guru/penilaian?assignmentId=<id>`

| No    | Skenario Pengujian                        | Input                                  | Hasil yang Diharapkan                                     | Hasil Aktual | Status |
| ----- | ----------------------------------------- | -------------------------------------- | --------------------------------------------------------- | ------------ | ------ |
| PN-01 | Lihat halaman penilaian tugas valid       | assignmentId: ID tugas yang ada        | Tampil data tugas + daftar siswa dengan status submission |              | ☐      |
| PN-02 | Penilaian dengan assignmentId kosong      | assignmentId: (kosong)                 | Muncul error "assignmentId wajib diisi" (400)             |              | ☐      |
| PN-03 | Penilaian dengan assignmentId tidak valid | assignmentId: "abc"                    | Muncul error "assignmentId tidak valid" (400)             |              | ☐      |
| PN-04 | Penilaian tugas yang tidak ada            | assignmentId: 99999                    | Muncul error "Tugas tidak ditemukan" (404)                |              | ☐      |
| PN-05 | Beri nilai ke submission siswa            | Pilih siswa → masukkan grade dan score | Nilai tersimpan di database, tampil di halaman            |              | ☐      |
| PN-06 | Lihat PDF submission siswa                | Klik link PDF submission               | File PDF terbuka di tab baru                              |              | ☐      |

---

## 10. Modul Assessment / Ujian (Guru)

**API:** `GET/POST /api/guru/assessments`

| No    | Skenario Pengujian                     | Input                                                          | Hasil yang Diharapkan                                   | Hasil Aktual | Status |
| ----- | -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- | ------------ | ------ |
| AS-01 | Buat assessment baru dengan data valid | guruId, kode: "QUIZ1", title: "Quiz Bab 1", className: "XTKJ1" | Assessment berhasil dibuat                              |              | ☐      |
| AS-02 | Buat assessment tanpa kode             | kode: (kosong)                                                 | Muncul error "Data tidak lengkap" (400)                 |              | ☐      |
| AS-03 | Buat assessment tanpa title            | title: (kosong)                                                | Muncul error "Data tidak lengkap" (400)                 |              | ☐      |
| AS-04 | Buat assessment tanpa className        | className: (kosong)                                            | Muncul error "Data tidak lengkap" (400)                 |              | ☐      |
| AS-05 | Lihat daftar assessment guru           | guruId: ID guru yang login                                     | Tampil semua assessment milik guru tersebut             |              | ☐      |
| AS-06 | Lihat assessment tanpa guruId          | guruId: (kosong)                                               | Muncul error "guruId wajib diisi" (400)                 |              | ☐      |
| AS-07 | Tambah soal ke assessment              | Kode assessment valid + data soal JSON                         | Soal berhasil ditambahkan                               |              | ☐      |
| AS-08 | Cek kode assessment unik               | Kode baru yang belum ada                                       | API return kode tersedia                                |              | ☐      |
| AS-09 | Cek kode assessment duplikat           | Kode yang sudah ada                                            | API return kode sudah dipakai                           |              | ☐      |
| AS-10 | Halaman buat soal                      | Akses `/buatsoal/[kode]`                                       | Tampil halaman pembuatan soal untuk assessment tersebut |              | ☐      |

---

## 11. Modul Middleware & Otorisasi

| No    | Skenario Pengujian              | Input                                       | Hasil yang Diharapkan                   | Hasil Aktual | Status |
| ----- | ------------------------------- | ------------------------------------------- | --------------------------------------- | ------------ | ------ |
| MW-01 | Akses `/` tanpa login           | Buka halaman `/` tanpa session              | Redirect ke `/login`                    |              | ☐      |
| MW-02 | Akses `/guru` tanpa login       | Buka halaman `/guru` tanpa session          | Redirect ke `/login`                    |              | ☐      |
| MW-03 | Siswa akses `/guru`             | Login sebagai siswa → akses `/guru`         | Redirect ke `/` (halaman siswa)         |              | ☐      |
| MW-04 | Guru akses `/`                  | Login sebagai guru → akses `/`              | Redirect ke `/guru`                     |              | ☐      |
| MW-05 | Siswa akses `/guru/nilai/1`     | Login sebagai siswa → akses `/guru/nilai/1` | Redirect ke `/` (halaman siswa)         |              | ☐      |
| MW-06 | Akses `/login` saat sudah login | Sudah punya session → buka `/login`         | Auto-redirect sesuai role               |              | ☐      |
| MW-07 | Akses `/register` tanpa login   | Buka `/register`                            | Halaman register tampil normal (publik) |              | ☐      |

---

## 12. Modul Logout

| No    | Skenario Pengujian            | Input                                   | Hasil yang Diharapkan                                   | Hasil Aktual | Status |
| ----- | ----------------------------- | --------------------------------------- | ------------------------------------------------------- | ------------ | ------ |
| LO-01 | Logout siswa                  | Klik tombol logout → konfirmasi "Ya"    | Session dihapus, redirect ke `/login`                   |              | ☐      |
| LO-02 | Logout guru                   | Klik tombol logout → konfirmasi "Ya"    | Session dihapus, redirect ke `/login`                   |              | ☐      |
| LO-03 | Batal logout                  | Klik tombol logout → konfirmasi "Tidak" | Tetap di halaman, session masih aktif                   |              | ☐      |
| LO-04 | Akses halaman setelah logout  | Logout → langsung akses `/`             | Redirect ke `/login`                                    |              | ☐      |
| LO-05 | Confetti reset setelah logout | Logout → login lagi                     | Confetti muncul lagi (localStorage dihapus saat logout) |              | ☐      |

---

## Ringkasan Hasil

| Modul                  | Jumlah Test Case | ✅ Berhasil | ❌ Gagal | ☐ Belum Diuji |
| ---------------------- | ---------------- | ----------- | -------- | ------------- |
| Registrasi             | 10               |             |          | 10            |
| Login                  | 13               |             |          | 13            |
| Dashboard Siswa        | 8                |             |          | 8             |
| Pengumpulan Tugas      | 6                |             |          | 6             |
| Dashboard Guru         | 7                |             |          | 7             |
| Buat Tugas             | 10               |             |          | 10            |
| Rekap Tugas            | 7                |             |          | 7             |
| Broadcast              | 7                |             |          | 7             |
| Penilaian              | 6                |             |          | 6             |
| Assessment/Ujian       | 10               |             |          | 10            |
| Middleware & Otorisasi | 7                |             |          | 7             |
| Logout                 | 5                |             |          | 5             |
| **TOTAL**              | **96**           |             |          | **96**        |

---

## Catatan Pengujian

### Prasyarat:

1. Web app berjalan di `https://kinantiku.com` atau `http://localhost:3000`
2. Bot WhatsApp aktif (untuk pengujian broadcast)
3. Database PostgreSQL (Supabase) terhubung
4. Minimal 1 akun guru dan 1 akun siswa sudah terdaftar
5. Minimal 1 tugas sudah dibuat

### Data Uji yang Dibutuhkan:

- **Akun Guru:** Nomor HP guru yang sudah terdaftar + password
- **Akun Siswa:** Nomor HP siswa yang sudah terdaftar + password
- **Kelas Valid:** XTKJ1, XTKJ2, XITKJ1, XITKJ2, XIITKJ1, XIITKJ2, TPTUP
- **File PDF:** File PDF valid untuk upload tugas
- **File Non-PDF:** File .docx/.png untuk test validasi upload

### Browser yang Diuji:

- [ ] Google Chrome (Desktop)
- [ ] Google Chrome (Mobile)
- [ ] Mozilla Firefox
- [ ] Microsoft Edge
- [ ] Safari (jika tersedia)

---

_Dokumen ini dibuat pada 7 Februari 2026_
