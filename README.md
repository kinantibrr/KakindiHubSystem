# Kakindi Griya — Sistem Informasi Persediaan Unit, Keuangan & Kuitansi Otomatis

> Dokumentasi analisis sistem, studi kelayakan, alur akuntansi, dan panduan penggunaan aplikasi web manajemen hunian & keuangan khusus pemilik (**Owner Portal**) untuk **Kakindi Griya** (mencakup **Kakindi Griya 1**, **Kakindi Griya 2 / Mezzanine**, dan **Kakindi Kost**).

---

## 1. Gambaran Umum Sistem

* **Nama Sistem:** Kakindi Griya Owner Portal — Sistem Persediaan Unit, Keuangan & Kuitansi Otomatis
* **Gambaran Sistem:** Aplikasi web khusus pemilik hunian untuk mengelola ketersediaan kamar/unit, mencatat transaksi penyewaan dan pengeluaran operasional, menyusun jurnal keuangan secara otomatis, memantau grafik *Net Income* serta statistika per cabang, dan menerbitkan kuitansi pembayaran otomatis.
* **Peran Pengguna:** Pemilik / Pengelola (`Owner`) — akses dibatasi hanya untuk pemilik melalui halaman login terpisah (penghuni tidak memiliki akses sistem).
* **Cakupan Cabang & Unit:**
  * **Kakindi Griya 1:** Unit `101`, `102`, `103`, `202` (Kontrakan Non-Mezzanine).
  * **Kakindi Griya 2:** Unit `M-01`, `M-02` (Kontrakan Mezzanine).
  * **Kakindi Kost:** Unit `101`, `102`, `103`, `104`, `205`, `206`, `207`, `208`, `209`, `210` (Kost), serta dukungan penambahan cabang/kamar baru melalui menu **Add Properti**.
* **Kategori Pengeluaran:** `Electricity` (Listrik), `Water` (Air/PDAM), `Perawatan` (Perawatan & Perbaikan), dan `Lain-lain`.
* **Format Kuitansi Otomatis:**
  * Hunian tipe **Kost** menerbitkan kuitansi dengan kop & format tanda terima **Kakindi Kost**.
  * Hunian tipe **Kontrakan** (reguler maupun *mezzanine*) menerbitkan kuitansi dengan kop & format tanda terima **Kakindi Griya** (lengkap dengan jumlah unit fasilitas).

---

## 2. Sistem Berjalan vs Sistem Usulan

### Sistem Berjalan (Pencatatan Manual / Asumsi)
* Pencatatan sewa, pengeluaran, dan kuitansi dilakukan manual menggunakan catatan kertas/spreadsheet terpisah.
* Pengecekan ketersediaan kamar pada rentang tanggal tertentu memerlukan pencarian ulang data penyewa satu per satu.
* Risiko salah hitung nominal/terbilang, slip kuitansi tercecer, serta rekap *Income*, *Expense*, dan *Net Income* yang memakan waktu.
* Jurnal dan ringkasan per cabang belum terhubung langsung dari transaksi harian.

### Sistem Usulan (Aplikasi Web Kakindi Griya)
* Seluruh transaksi penyewaan, kuitansi, properti/kamar, dan pengeluaran tercatat secara terdigitalisasi dan terhubung ke database.
* Status kamar (`Available` / `Rented`) serta filter ketersediaan berdasarkan rentang tanggal tampil langsung di **Dashboard** dan **Add Properti**.
* Setiap pembayaran sewa dan pengeluaran otomatis tercatat ke **Jurnal Keuangan** serta memperbarui **Income**, **Expense**, **Net Income**, dan grafik **Statistika**.
* Kuitansi otomatis terformat sesuai jenis hunian (**Kakindi Kost** atau **Kakindi Griya**) dan siap dicetak / disimpan sebagai PDF.

---

## 3. Kebutuhan Fungsional

| No | Kebutuhan Fungsional | Keterangan | Prioritas |
| :--- | :--- | :--- | :--- |
| 1 | **Login & Akses Pemilik** | Autentikasi khusus pemilik (`Owner`) sebelum mengakses dashboard dan seluruh modul. | Tinggi |
| 2 | **Dashboard Ringkasan & Grafik** | Ringkasan *Income* per cabang, *Expense* per kategori, *Room Available* dengan filter tanggal, filter periode (*Per Bulan* / *Per Tahun*), dan grafik *Net Income*. | Tinggi |
| 3 | **Proses Penyewaan & Kuitansi** | Input penyewa baru, hitung durasi & nominal otomatis, terbitkan kuitansi sesuai jenis hunian, cetak/simpan PDF, dan lihat riwayat kuitansi. | Tinggi |
| 4 | **Manajemen Properti & Kamar** | Tambah cabang/kamar baru (tombol `+`), edit cabang/harga/kamar atau hapus properti/kamar (menu `⋮`), serta pantau unit *Available* & *Rented*. | Tinggi |
| 5 | **Pencatatan Pengeluaran** | Catat pengeluaran berdasarkan tanggal, cabang, kategori (`Electricity`, `Water`, `Perawatan`, `Lain-lain`), nominal, dan keterangan. | Tinggi |
| 6 | **Jurnal Keuangan** | Menampilkan rekap pencatatan transaksi pemasukan dan pengeluaran (Debit/Kredit) secara terstruktur. | Sedang |
| 7 | **Statistika per Cabang** | Visualisasi grafik perbandingan *Income vs Expense* dan *Net Income* bulanan per cabang berdasarkan tahun. | Sedang |
| 8 | **Log Out** | Mengakhiri sesi login pemilik dan mengembalikan tampilan ke layar login. | Tinggi |

---

## 4. Alur Data dan Akuntansi

1. **Master Properti & Kamar (`unit_hunian`):** Menyimpan kode unit, nama cabang, jenis hunian, harga sewa bulanan, status ketersediaan, dan daftar fasilitas (`JSONB`).
2. **Penyewaan & Pembayaran (`penyewa` & `pembayaran`):** Saat penyewa baru disimpan, status unit diperbarui menjadi terisi (`FALSE`) dan data pembayaran beserta nomor kuitansi, periode sewa, nominal, dan terbilang tersimpan.
3. **Pengeluaran (`pengeluaran`):** Mencatat beban operasional per tanggal, cabang, kategori, dan nominal.
4. **Jurnal Keuangan (`jurnal_keuangan`):** Terisi otomatis melalui *database trigger* saat transaksi pembayaran sewa atau pengeluaran masuk:
   * **Pemasukan Sewa:** Tercatat sebagai `Pemasukan` pada akun `Pendapatan Sewa Hunian` dengan nilai `Debit` sebesar nominal pembayaran.
   * **Pengeluaran Beban:** Tercatat sebagai `Pengeluaran` pada akun `Beban <Kategori>` dengan nilai `Kredit` sebesar nominal pengeluaran.
5. **Agregasi Dashboard & Statistika:** Mengolah data pemasukan dan pengeluaran berdasarkan filter periode (*Per Bulan* atau *Per Tahun*) untuk menampilkan *Income*, *Expense*, *Net Income*, grafik tahunan, dan grafik per cabang.

---

## 5. Studi Kelayakan

### A. Kelayakan Operasional
* **Kesiapan Pengguna:** Antarmuka berbahasa Indonesia dengan alur menu dan formulir yang lugas untuk pemilik hunian.
* **Kesesuaian Proses:** Mengikuti alur operasional pengelolaan hunian: cek ketersediaan kamar, catat penyewaan & terbitkan kuitansi, catat pengeluaran, lalu pantau jurnal dan laporan grafik.
* **Pelatihan:** Singkat, karena navigasi tersusun jelas pada *sidebar* kanan (*Dashboard*, *Kuitansi*, *Add Properti*, *Statistika*, *Pengeluaran*, *Jurnal*, *Log Out*).
* **Dukungan Pemilik:** Pemilik dapat memantau kinerja tiap cabang dan mencetak kuitansi tanpa rekap manual berulang.
* **Kesimpulan:** **Layak secara operasional.**

### B. Kelayakan Biaya (Estimasi)

| Komponen | Estimasi Biaya | Keterangan |
| :--- | :--- | :--- |
| Perangkat (Laptop / HP yang ada) | Rp0 | Menggunakan perangkat yang sudah dimiliki |
| Domain kustom (opsional) | Rp0 – Rp150.000 / tahun | Bisa menggunakan subdomain bawaan GitHub Pages (`*.github.io`) |
| Backend & Database (Supabase) | Rp0 – Rp1.200.000 / tahun | Tier gratis untuk tahap awal; berbayar jika meningkat |
| Pemeliharaan & cadangan data | Rp0 – Rp500.000 / tahun | Penyesuaian konten & pencadangan berkala |
| **Total Estimasi Tahun Pertama** | **Rp0 – Rp1.850.000** | *Angka berupa estimasi asumsi untuk skala pengelolaan hunian* |

### C. Kelayakan Teknis, Hukum, dan Jadwal
* **Kelayakan Teknis:** Menggunakan HTML5, CSS3, JavaScript, Chart.js, dan Supabase tanpa instalasi server rumit; memerlukan koneksi internet untuk sinkronisasi *database* dan pemuatan pustaka eksternal.
* **Kelayakan Hukum & Data:** Data penyewa (nama, nomor telepon, riwayat sewa) dan catatan keuangan dikelola secara hati-hati dengan pembatasan akses khusus pemilik; disarankan menjaga kerahasiaan kredensial serta mengetatkan kebijakan RLS/autentikasi sebelum penggunaan produksi penuh.
* **Jadwal Pengembangan (Estimasi):**
  * Analisis & perancangan sistem/database: *2 minggu*
  * Pengembangan antarmuka, integrasi Supabase & kuitansi otomatis: *3 minggu*
  * Uji coba, pengisian data & penyesuaian: *1 minggu*

---

## 6. Struktur Folder Proyek

```text
griya-kakindi-system/
├── backend/
│   └── schema.sql
├── frontend/
│   ├── CSS/
│   │   └── style.css
│   ├── HTML/
│   │   └── index.html
│   └── JS/
│       ├── app.js
│       ├── config.js
└── README.md
```

---

## 7. Panduan Instalasi, Deployment GitHub & Uji Sistem

### Langkah Setup & Deployment
1. **Jalankan Skrip Database di Supabase:** Buka menu **SQL Editor** pada proyek Supabase Anda, *paste* isi `backend/schema.sql`, lalu klik **Run**.
2. **Atur Konfigurasi Frontend:** Pastikan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `OWNER_CREDENTIALS` di `frontend/JS/config.js` sudah sesuai.
3. **Upload ke GitHub & Aktifkan GitHub Pages:**
   * *Upload* proyek ke repositori GitHub Anda.
   * Buka **Settings > Pages**, pilih *branch* utama (misalnya `main`), simpan, lalu tunggu hingga tautan GitHub Pages aktif.

### Informasi Uji Sistem
* **Repository GitHub:** `https://github.com/kinantibrr/kakindikostsystem/tree/main`
* **Web Apps (GitHub Pages):** `file:///D:/KULIAH/SMT%205/KODE/griya-kakindi-system/frontend/HTML/index.html`
* **Akun Uji Pemilik (Owner):** `owner_kakindi` / `kakindi2026`

### Skenario Uji
1. Buka tautan aplikasi dan login menggunakan akun pemilik (`Owner`); pastikan penghuni/pengguna tanpa kredensial tidak dapat masuk.
2. Di **Dashboard**, uji filter periode (**Per Bulan** dan **Per Tahun**) serta filter tanggal **Room Available** (`dari tanggal` s/d `sampai tanggal`).
3. Di menu **Add Properti**, coba tambah cabang/kamar baru (`+`) serta edit atau hapus data melalui menu titik tiga (`⋮`).
4. Di menu **Kuitansi**, input transaksi penyewaan baru dan pastikan kuitansi terbit otomatis (format **Kakindi Kost** untuk unit kost, **Kakindi Griya** untuk unit kontrakan) serta dapat dicetak/disimpan sebagai PDF.
5. Di menu **Pengeluaran**, catat satu pengeluaran baru lalu periksa bahwa nilainya masuk ke **Jurnal**, memengaruhi **Expense** & **Net Income** di **Dashboard**, serta tercermin pada grafik **Statistika**.
6. Klik **Log Out** dan pastikan sesi berakhir dengan kembali ke layar login.
