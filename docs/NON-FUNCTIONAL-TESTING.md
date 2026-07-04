# 🧪 Pengujian Non-Fungsionalitas - Chatbot Kinanti

**Versi:** 1.0
**Tanggal:** 11 Februari 2026
**Penguji:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**URL Web:** https://kinantiku.com
**URL Bot:** https://bot.kinantiku.com

---

**Tujuan dari pengujian ini adalah untuk memastikan seluruh fungsi pada sistem Kinanti LMS (Learning Management System) berjalan sesuai dengan spesifikasi kebutuhan yang telah ditetapkan. Berikan centang ( ✓ ) pada kolom Hasil Aktual jika hasil pengujian sesuai yang diharapkan, dan ( ✗ ) jika tidak.**

**Nama Penguji:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 📋 Daftar Isi

1. [Keamanan (Security)](#1-keamanan-security)
2. [Performa (Performance)](#2-performa-performance)
3. [Kompatibilitas (Compatibility)](#3-kompatibilitas-compatibility)
4. [Responsivitas (Responsiveness)](#4-responsivitas-responsiveness)
5. [Usability / Kemudahan Penggunaan](#5-usability--kemudahan-penggunaan)
6. [Keandalan (Reliability)](#6-keandalan-reliability)
7. [SEO & Aksesibilitas Web](#7-seo--aksesibilitas-web)
8. [Ringkasan Hasil](#ringkasan-hasil)

---

## 1. Keamanan (Security)

| No   | Skenario Pengujian                                                                              | Teknik Pengujian                                 | Hasil yang Diharapkan                                                                     | Ya  | Tidak |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --- | ----- |
| K-01 | Input SQL Injection pada form login (contoh: `' OR 1=1 --`)                                     | Uji manual pada field Phone/Password             | Sistem tidak mengeksekusi perintah SQL berbahaya, login ditolak dengan pesan error normal |     |       |
| K-02 | Input XSS (Cross-Site Scripting) pada form registrasi (contoh: `<script>alert('xss')</script>`) | Uji manual pada field Nama                       | Script tidak dieksekusi, input di-escape atau ditolak                                     |     |       |
| K-03 | Akses API broadcast tanpa autentikasi (`POST /api/guru/broadcast` tanpa BOT_SECRET)             | Postman / cURL                                   | API menolak akses dengan response 401 Unauthorized                                        |     |       |
| K-04 | Akses halaman `/guru` tanpa login                                                               | Uji manual browser                               | Redirect otomatis ke halaman `/login`, bukan menampilkan data guru                        |     |       |
| K-05 | Siswa mencoba mengakses fitur/halaman guru (`/guru`)                                            | Uji manual — login sebagai siswa → akses `/guru` | Sistem memblokir akses dan redirect ke `/` (halaman siswa)                                |     |       |
| K-06 | Guru mencoba mengakses halaman siswa (`/`)                                                      | Uji manual — login sebagai guru → akses `/`      | Sistem redirect ke `/guru` sesuai role                                                    |     |       |
| K-07 | Manipulasi parameter `guruId` pada URL API (contoh: `?guruId=999`)                              | Postman / cURL                                   | API hanya menampilkan data milik guru yang sedang login, bukan guru lain                  |     |       |
| K-08 | Brute-force login dengan password salah berturut-turut (5x)                                     | Uji manual pada form login                       | Sistem tetap berjalan normal tanpa crash, menampilkan error setiap percobaan              |     |       |
| K-09 | Upload file berbahaya (file .exe diubah ekstensi menjadi .pdf)                                  | Uji manual upload tugas                          | Sistem menolak file atau memvalidasi tipe file yang sebenarnya                            |     |       |
| K-10 | Password tersimpan dalam bentuk hash di database                                                | Inspeksi database (Prisma Studio / psql)         | Password tidak tersimpan dalam plaintext, menggunakan bcrypt hash                         |     |       |
| K-11 | Token JWT session memiliki expiry time                                                          | Inspeksi cookie / developer tools                | Token memiliki batas waktu expired, tidak berlaku selamanya                               |     |       |
| K-12 | Input SQL Injection pada pesan bot WhatsApp (contoh: `tugas ' OR 1=1 --`)                       | Uji manual WhatsApp                              | Bot tidak mengeksekusi perintah berbahaya dan menampilkan pesan fallback                  |     |       |
| K-13 | Akses API tanpa header Content-Type yang benar                                                  | Postman / cURL                                   | API mengembalikan error yang sesuai, tidak crash                                          |     |       |

---

## 2. Performa (Performance)

| No   | Skenario Pengujian                                           | Teknik Pengujian                                 | Hasil yang Diharapkan                                                     | Ya  | Tidak |
| ---- | ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- | --- | ----- |
| P-01 | Waktu loading halaman login (`/login`)                       | Stopwatch manual / Chrome DevTools (Network tab) | Halaman login tampil dalam waktu kurang dari 3 detik                      |     |       |
| P-02 | Waktu loading halaman dashboard siswa (`/`) setelah login    | Stopwatch manual / Chrome DevTools               | Dashboard siswa tampil dengan data tugas dalam waktu kurang dari 5 detik  |     |       |
| P-03 | Waktu loading halaman dashboard guru (`/guru`) setelah login | Stopwatch manual / Chrome DevTools               | Dashboard guru tampil dengan data tugas dalam waktu kurang dari 5 detik   |     |       |
| P-04 | Waktu respons bot saat menerima pesan sapaan ("Halo")        | Stopwatch manual WhatsApp                        | Bot merespons pesan dalam waktu kurang dari 3 detik                       |     |       |
| P-05 | Waktu respons bot menampilkan daftar tugas siswa             | Stopwatch manual WhatsApp                        | Bot menampilkan data tugas dengan waktu respons wajar (< 5 detik)         |     |       |
| P-06 | Waktu respons API `GET /api/guru/assignments`                | Chrome DevTools / Postman                        | Response time kurang dari 2 detik                                         |     |       |
| P-07 | Waktu proses upload tugas PDF (ukuran ≤ 5MB)                 | Stopwatch manual                                 | Upload selesai dan feedback muncul dalam waktu kurang dari 10 detik       |     |       |
| P-08 | Waktu proses broadcast ke 1 kelas (± 30 siswa)               | Stopwatch manual dari dashboard guru             | Proses broadcast selesai dalam waktu kurang dari 30 detik                 |     |       |
| P-09 | Waktu proses rekap tugas dan download Excel                  | Stopwatch manual                                 | Rekap tampil dan file Excel ter-download dalam waktu kurang dari 10 detik |     |       |
| P-10 | Waktu render halaman 404                                     | Chrome DevTools                                  | Halaman 404 tampil dengan animasi dalam waktu kurang dari 3 detik         |     |       |
| P-11 | Performa dengan banyak tugas (> 20 tugas aktif)              | Uji manual / Simulasi data                       | Tabel tugas tetap responsif dan tidak lag saat di-scroll                  |     |       |
| P-12 | Vercel Speed Insights score                                  | Vercel Dashboard / Lighthouse                    | Score performance ≥ 70 pada Lighthouse                                    |     |       |

---

## 3. Kompatibilitas (Compatibility)

### 3a. Kompatibilitas Browser

| No    | Skenario Pengujian                         | Teknik Pengujian      | Hasil yang Diharapkan                           | Ya  | Tidak |
| ----- | ------------------------------------------ | --------------------- | ----------------------------------------------- | --- | ----- |
| KB-01 | Akses website di Google Chrome (Desktop)   | Uji manual browser    | Semua halaman tampil dan berfungsi dengan benar |     |       |
| KB-02 | Akses website di Mozilla Firefox (Desktop) | Uji manual browser    | Semua halaman tampil dan berfungsi dengan benar |     |       |
| KB-03 | Akses website di Microsoft Edge (Desktop)  | Uji manual browser    | Semua halaman tampil dan berfungsi dengan benar |     |       |
| KB-04 | Akses website di Safari (macOS/iOS)        | Uji manual browser    | Semua halaman tampil dan berfungsi dengan benar |     |       |
| KB-05 | Akses website di Google Chrome (Android)   | Uji manual HP Android | Semua halaman tampil dan berfungsi dengan benar |     |       |
| KB-06 | Akses website di Safari (iPhone)           | Uji manual HP iOS     | Semua halaman tampil dan berfungsi dengan benar |     |       |

### 3b. Kompatibilitas Perangkat

| No    | Skenario Pengujian                          | Teknik Pengujian                                    | Hasil yang Diharapkan                                                         | Ya  | Tidak |
| ----- | ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | --- | ----- |
| KP-01 | Akses website di laptop/PC (layar ≥ 1024px) | Uji manual desktop                                  | Layout tampil dalam mode desktop, tabel penuh, sidebar terlihat               |     |       |
| KP-02 | Akses website di tablet (layar ± 768px)     | Uji manual tablet / Chrome DevTools responsive mode | Layout menyesuaikan layar tablet, elemen tidak overlap                        |     |       |
| KP-03 | Akses website di smartphone (layar ≤ 480px) | Uji manual HP / Chrome DevTools responsive mode     | Layout mobile-friendly, tabel bisa di-scroll horizontal, tombol mudah diakses |     |       |

---

## 4. Responsivitas (Responsiveness)

| No   | Skenario Pengujian                                   | Teknik Pengujian                               | Hasil yang Diharapkan                                                            | Ya  | Tidak |
| ---- | ---------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- | --- | ----- |
| R-01 | Halaman login responsif pada layar mobile (360px)    | Chrome DevTools → Responsive mode → 360x640    | Form login tidak terpotong, tombol dan input terlihat penuh, gambar menyesuaikan |     |       |
| R-02 | Halaman register responsif pada layar mobile (360px) | Chrome DevTools → Responsive mode → 360x640    | Form registrasi terlihat lengkap, dropdown kelas bisa diakses                    |     |       |
| R-03 | Dashboard siswa responsif pada layar mobile          | Chrome DevTools → Responsive mode              | Kartu tugas tertata vertikal, pencarian terlihat, tombol logout accessible       |     |       |
| R-04 | Dashboard guru responsif pada layar mobile           | Chrome DevTools → Responsive mode              | Tabel tugas bisa di-scroll horizontal, tombol aksi terlihat dan bisa diklik      |     |       |
| R-05 | Halaman 404 responsif pada layar mobile              | Chrome DevTools → Responsive mode              | Animasi buku, angka 404, dan tombol kembali tampil proporsional                  |     |       |
| R-06 | Modal "Buat Tugas" responsif pada layar mobile       | Chrome DevTools → Responsive mode → buka modal | Modal tidak keluar layar, semua field dan tombol bisa diakses                    |     |       |
| R-07 | Tabel rekap tugas responsif                          | Chrome DevTools → Responsive mode              | Tabel bisa di-scroll horizontal tanpa merusak layout keseluruhan                 |     |       |
| R-08 | Resize browser dari desktop ke mobile (live resize)  | Drag ukuran browser secara manual              | Layout berubah mulus tanpa elemen overlap atau terpotong                         |     |       |

---

## 5. Usability / Kemudahan Penggunaan

| No   | Skenario Pengujian                                                 | Teknik Pengujian                                        | Hasil yang Diharapkan                                                           | Ya  | Tidak |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------- | --- | ----- |
| U-01 | Navigasi dari login ke dashboard tanpa kebingungan                 | Uji manual oleh penguji                                 | Alur login → dashboard jelas, tidak ada halaman mati/blank                      |     |       |
| U-02 | Feedback saat login berhasil                                       | Uji manual                                              | Muncul notifikasi SweetAlert "Login Berhasil!" sebelum redirect                 |     |       |
| U-03 | Feedback saat login gagal                                          | Uji manual (password salah)                             | Muncul pesan error yang jelas, bukan pesan teknis/kode error                    |     |       |
| U-04 | Loading indicator saat proses berjalan                             | Uji manual (login, upload, broadcast)                   | Selalu ada indikator loading (spinner, skeleton, text "Memproses...")           |     |       |
| U-05 | Konfirmasi sebelum aksi destruktif (logout, hapus tugas)           | Uji manual                                              | Muncul dialog konfirmasi sebelum aksi dilakukan                                 |     |       |
| U-06 | Pesan error bot WhatsApp mudah dipahami                            | Uji manual WhatsApp — kirim pesan yang tidak dimengerti | Bot merespons dengan pesan fallback yang ramah dan membantu                     |     |       |
| U-07 | Feedback saat upload tugas berhasil                                | Uji manual upload tugas di dashboard siswa              | Muncul notifikasi berhasil, status tugas berubah menjadi "Selesai"              |     |       |
| U-08 | Feedback saat broadcast selesai                                    | Uji manual broadcast dari dashboard guru                | Muncul notifikasi jumlah pesan terkirim (misal: "Berhasil dikirim ke 25 siswa") |     |       |
| U-09 | Warna dan kontras teks mudah dibaca                                | Inspeksi visual manual                                  | Teks memiliki kontras yang cukup terhadap background, mudah dibaca              |     |       |
| U-10 | Tombol dan link memiliki ukuran yang cukup untuk di-klik di mobile | Uji manual pada HP                                      | Semua tombol/link minimal 44x44px sesuai standar aksesibilitas                  |     |       |
| U-11 | Confetti animasi tidak mengganggu interaksi                        | Uji manual — login pertama kali                         | Confetti tampil sesaat lalu hilang, tidak menutupi elemen interaktif            |     |       |
| U-12 | Halaman 404 memberikan arahan yang jelas                           | Akses URL yang tidak ada (misal: `/xyz123`)             | Halaman 404 tampil dengan tombol "Kembali ke Beranda" dan "Login"               |     |       |

---

## 6. Keandalan (Reliability)

| No    | Skenario Pengujian                                                    | Teknik Pengujian                                                       | Hasil yang Diharapkan                                             | Ya  | Tidak |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | --- | ----- |
| RL-01 | Website tetap bisa diakses setelah refresh berulang (5x cepat)        | Uji manual — tekan F5 cepat 5 kali                                     | Website tetap tampil normal tanpa error 500                       |     |       |
| RL-02 | Session tetap aktif setelah berpindah halaman                         | Uji manual — navigasi antar halaman                                    | User tidak perlu login ulang saat berpindah halaman               |     |       |
| RL-03 | Data tugas tetap konsisten setelah refresh                            | Uji manual — buat tugas → refresh halaman                              | Tugas yang baru dibuat masih tampil di daftar                     |     |       |
| RL-04 | Bot WhatsApp tetap merespons setelah menerima 10 pesan berturut-turut | Uji manual WhatsApp                                                    | Bot merespons semua 10 pesan tanpa crash atau timeout             |     |       |
| RL-05 | Upload tugas tetap berhasil setelah gagal 1x (retry)                  | Uji manual — gagalkan upload (matikan internet) → nyalakan → coba lagi | Upload berhasil pada percobaan kedua                              |     |       |
| RL-06 | Website bisa diakses kembali setelah Vercel deploy ulang              | Uji setelah deploy                                                     | Website kembali online dalam waktu kurang dari 1 menit            |     |       |
| RL-07 | Bot otomatis reconnect setelah koneksi WhatsApp terputus              | Simulasi — matikan internet sesaat → nyalakan kembali                  | Bot reconnect dan bisa menerima pesan kembali                     |     |       |
| RL-08 | Scheduled reminder (cron job) berjalan sesuai jadwal                  | Verifikasi log / uji manual                                            | Reminder deadline terkirim pada jam 08:00 pagi sesuai konfigurasi |     |       |
| RL-09 | Halaman tidak menampilkan error Prisma ke user                        | Uji manual — akses saat DB load tinggi                                 | Error ditangani dengan pesan user-friendly, bukan stack trace     |     |       |
| RL-10 | Concurrent access — 2 guru buka dashboard bersamaan                   | Uji manual — 2 browser berbeda                                         | Kedua guru melihat data masing-masing dengan benar                |     |       |

---

## 7. SEO & Aksesibilitas Web

| No   | Skenario Pengujian                                              | Teknik Pengujian                        | Hasil yang Diharapkan                                                                       | Ya  | Tidak |
| ---- | --------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- | --- | ----- |
| S-01 | Meta tag title dan description terisi pada setiap halaman       | Chrome DevTools → Elements → `<head>`   | Meta title: "Kinantiku - Sistem Pengelolaan Tugas Siswa SMKN 3 Buduran", description terisi |     |       |
| S-02 | Open Graph meta tags tersedia untuk social sharing              | Chrome DevTools → Elements → `<head>`   | Tag `og:title`, `og:description`, `og:image`, `og:url` terisi                               |     |       |
| S-03 | Twitter Card meta tags tersedia                                 | Chrome DevTools → Elements → `<head>`   | Tag `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` terisi          |     |       |
| S-04 | Favicon tampil di tab browser                                   | Uji visual pada tab browser             | Icon Kinanti tampil di tab browser, bukan icon default                                      |     |       |
| S-05 | Atribut `lang="id"` pada tag `<html>`                           | Chrome DevTools → Elements              | Tag `<html>` memiliki atribut `lang="id"`                                                   |     |       |
| S-06 | Viewport meta tag untuk mobile                                  | Chrome DevTools → Elements → `<head>`   | Tag `<meta name="viewport" content="width=device-width, initial-scale=1">` ada              |     |       |
| S-07 | Schema.org JSON-LD structured data tersedia                     | Chrome DevTools → Elements → `<head>`   | Script JSON-LD dengan type "WebSite" tersedia di halaman                                    |     |       |
| S-08 | Canonical URL terisi                                            | Chrome DevTools → Elements → `<head>`   | Tag `<link rel="canonical" href="https://kinantiku.com">` ada                               |     |       |
| S-09 | Semua gambar memiliki atribut alt text                          | Chrome DevTools → Inspect gambar        | Gambar (logo, ilustrasi login/register) memiliki atribut `alt` yang deskriptif              |     |       |
| S-10 | Halaman tidak memiliki error di Google Lighthouse Accessibility | Chrome Lighthouse → Accessibility audit | Accessibility score ≥ 70 pada Lighthouse                                                    |     |       |

---

## Ringkasan Hasil

| Kategori                         | Jumlah Test Case | ✅ Ya | ❌ Tidak | ☐ Belum Diuji |
| -------------------------------- | ---------------- | ----- | -------- | ------------- |
| Keamanan (Security)              | 13               |       |          | 13            |
| Performa (Performance)           | 12               |       |          | 12            |
| Kompatibilitas Browser           | 6                |       |          | 6             |
| Kompatibilitas Perangkat         | 3                |       |          | 3             |
| Responsivitas (Responsiveness)   | 8                |       |          | 8             |
| Usability / Kemudahan Penggunaan | 12               |       |          | 12            |
| Keandalan (Reliability)          | 10               |       |          | 10            |
| SEO & Aksesibilitas Web          | 10               |       |          | 10            |
| **TOTAL**                        | **74**           |       |          | **74**        |

---

## Catatan Pengujian

### Prasyarat:

1. Web app berjalan di `https://kinantiku.com` atau `http://localhost:3000`
2. Bot WhatsApp aktif dan terhubung (untuk pengujian bot)
3. Database PostgreSQL (Supabase) terhubung
4. Minimal 1 akun guru dan 1 akun siswa sudah terdaftar
5. Minimal 1 tugas sudah dibuat untuk pengujian performa
6. Koneksi internet stabil

### Tools yang Digunakan:

- **Google Chrome DevTools** — untuk inspeksi network, performance, responsive mode
- **Google Lighthouse** — untuk audit performance, accessibility, SEO
- **Postman / cURL** — untuk pengujian API secara langsung
- **Vercel Speed Insights** — untuk monitoring performa production
- **Stopwatch manual** — untuk pengukuran waktu respons bot
- **Browser berbeda** — Chrome, Firefox, Edge, Safari untuk kompatibilitas

### Browser yang Diuji:

- [ ] Google Chrome (Desktop)
- [ ] Google Chrome (Android)
- [ ] Mozilla Firefox (Desktop)
- [ ] Microsoft Edge (Desktop)
- [ ] Safari (macOS/iOS)

### Perangkat yang Diuji:

- [ ] Laptop/PC (≥ 1024px)
- [ ] Tablet (± 768px)
- [ ] Smartphone (≤ 480px)

---

_Dokumen ini dibuat pada 11 Februari 2026_
