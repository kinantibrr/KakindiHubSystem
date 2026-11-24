-- Bersihkan tabel lama jika ingin reset dari awal
DROP TABLE IF EXISTS jurnal_keuangan CASCADE;
DROP TABLE IF EXISTS pengeluaran CASCADE;
DROP TABLE IF EXISTS pembayaran CASCADE;
DROP TABLE IF EXISTS penyewa CASCADE;
DROP TABLE IF EXISTS unit_hunian CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ENTITAS: UNIT_HUNIAN (Master Properti & Kamar)
-- ==========================================
CREATE TABLE unit_hunian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_unit VARCHAR(20) NOT NULL,
    nama_cabang VARCHAR(100) NOT NULL,
    jenis_hunian VARCHAR(50) NOT NULL,
    harga_bulanan NUMERIC(12, 2) NOT NULL,
    status_tersedia BOOLEAN NOT NULL DEFAULT TRUE,
    daftar_fasilitas JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(nama_cabang, kode_unit)
);

-- ==========================================
-- 2. ENTITAS: PENYEWA
-- ==========================================
CREATE TABLE penyewa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES unit_hunian(id) ON DELETE RESTRICT,
    nama_lengkap VARCHAR(150) NOT NULL,
    no_telepon VARCHAR(30),
    tgl_mulai_sewa DATE NOT NULL,
    tgl_selesai_sewa DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. ENTITAS: PEMBAYARAN (Income Sewa)
-- ==========================================
CREATE TABLE pembayaran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penyewa_id UUID NOT NULL REFERENCES penyewa(id) ON DELETE CASCADE,
    nomor_kuitansi VARCHAR(50) NOT NULL UNIQUE,
    tgl_bayar DATE NOT NULL DEFAULT CURRENT_DATE,
    durasi_bulan INT NOT NULL CHECK (durasi_bulan > 0),
    periode_mulai DATE NOT NULL,
    periode_selesai DATE NOT NULL,
    nominal NUMERIC(12, 2) NOT NULL,
    terbilang TEXT NOT NULL,
    penerima VARCHAR(100) NOT NULL DEFAULT 'Ayi Setiowartini',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. TABEL PENGELUARAN (Expense)
-- ==========================================
CREATE TABLE pengeluaran (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tgl_pengeluaran DATE NOT NULL DEFAULT CURRENT_DATE,
    nama_cabang VARCHAR(100) NOT NULL,
    kategori VARCHAR(80) NOT NULL,
    keterangan TEXT,
    nominal NUMERIC(12, 2) NOT NULL CHECK (nominal > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. TABEL JURNAL KEUANGAN (Terintegrasi Otomatis)
-- ==========================================
CREATE TABLE jurnal_keuangan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tanggal DATE NOT NULL,
    cabang VARCHAR(100) NOT NULL,
    jenis_transaksi VARCHAR(20) NOT NULL CHECK (jenis_transaksi IN ('Pemasukan', 'Pengeluaran')),
    akun VARCHAR(100) NOT NULL,
    keterangan TEXT NOT NULL,
    debit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    kredit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    referensi_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- TRIGGER OTOMATIS
-- ==========================================
CREATE OR REPLACE FUNCTION set_unit_terisi()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE unit_hunian SET status_tersedia = FALSE WHERE id = NEW.unit_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_penyewa_baru
AFTER INSERT ON penyewa
FOR EACH ROW EXECUTE FUNCTION set_unit_terisi();

CREATE OR REPLACE FUNCTION log_jurnal_pembayaran()
RETURNS TRIGGER AS $$
DECLARE
    v_cabang VARCHAR(100);
    v_kode VARCHAR(20);
    v_nama VARCHAR(150);
BEGIN
    SELECT u.nama_cabang, u.kode_unit, p.nama_lengkap
    INTO v_cabang, v_kode, v_nama
    FROM penyewa p
    JOIN unit_hunian u ON p.unit_id = u.id
    WHERE p.id = NEW.penyewa_id;

    INSERT INTO jurnal_keuangan (tanggal, cabang, jenis_transaksi, akun, keterangan, debit, kredit, referensi_id)
    VALUES (
        NEW.tgl_bayar,
        v_cabang,
        'Pemasukan',
        'Pendapatan Sewa Hunian',
        'Sewa Unit ' || v_kode || ' (' || v_nama || ') - ' || NEW.nomor_kuitansi,
        NEW.nominal,
        0,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jurnal_pembayaran
AFTER INSERT ON pembayaran
FOR EACH ROW EXECUTE FUNCTION log_jurnal_pembayaran();

CREATE OR REPLACE FUNCTION log_jurnal_pengeluaran()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO jurnal_keuangan (tanggal, cabang, jenis_transaksi, akun, keterangan, debit, kredit, referensi_id)
    VALUES (
        NEW.tgl_pengeluaran,
        NEW.nama_cabang,
        'Pengeluaran',
        'Beban ' || NEW.kategori,
        COALESCE(NEW.keterangan, NEW.kategori),
        0,
        NEW.nominal,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jurnal_pengeluaran
AFTER INSERT ON pengeluaran
FOR EACH ROW EXECUTE FUNCTION log_jurnal_pengeluaran();

-- ==========================================
-- HAK AKSES & RLS UNTUK FRONTEND
-- ==========================================
ALTER TABLE unit_hunian ENABLE ROW LEVEL SECURITY;
ALTER TABLE penyewa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal_keuangan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access unit_hunian" ON unit_hunian FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access penyewa" ON penyewa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access pembayaran" ON pembayaran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access pengeluaran" ON pengeluaran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access jurnal_keuangan" ON jurnal_keuangan FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE unit_hunian, penyewa, pembayaran, pengeluaran, jurnal_keuangan TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ==========================================
-- SEED DATA 1: DAFTAR KAMAR SESUAI CABANG
-- ==========================================
INSERT INTO unit_hunian (kode_unit, nama_cabang, jenis_hunian, harga_bulanan, daftar_fasilitas) VALUES
('101', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"AC 3/4PK","qty":1},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Tabung gas melon","qty":1},{"item":"Kompor gas","qty":1},{"item":"Gorden","qty":3},{"item":"Kloset duduk","qty":1},{"item":"Rak Sabun","qty":1},{"item":"Shower","qty":2}]'::jsonb),
('102', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb),
('103', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb),
('202', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb),
('M-01', 'Kakindi Griya 2', 'Kontrakan Mezzanine', 2200000, '[{"item":"Dapur","qty":1},{"item":"Balkon / Area Cuci Jemur","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Parkir Mobil","qty":1}]'::jsonb),
('M-02', 'Kakindi Griya 2', 'Kontrakan Mezzanine', 2200000, '[{"item":"Dapur","qty":1},{"item":"Balkon / Area Cuci Jemur","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Parkir Mobil","qty":1}]'::jsonb);

INSERT INTO unit_hunian (kode_unit, nama_cabang, jenis_hunian, harga_bulanan, daftar_fasilitas)
SELECT
    kode,
    'Kakindi Kost',
    'Kost',
    2000000,
    '[{"item":"Kasur 120x200 + Bantal","qty":1},{"item":"Lemari pakaian","qty":1},{"item":"Lemari buku","qty":1},{"item":"Meja","qty":1},{"item":"Kursi","qty":1},{"item":"AC 1/2PK","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Rak Sabun","qty":1},{"item":"Gorden","qty":1}]'::jsonb
FROM unnest(ARRAY['101','102','103','104','205','206','207','208','209','210']) AS kode;

-- ==========================================
-- SEED DATA 2: PEMASUKAN SEWA (PENYEWA & PEMBAYARAN 2024 - 2026)
-- ==========================================
DO $$
DECLARE
    v_u UUID;
    v_p UUID;
BEGIN
    -- --- TAHUN 2024 ---
    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '101';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Hendra Wijaya', '081211001101', '2024-01-05', '2024-04-04') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.01/01/05/2024', '2024-01-05', 3, '2024-01-05', '2024-04-04', 7500000, 'Tujuh Juta Lima Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-01';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Ratna Sari', '081211001102', '2024-02-12', '2024-05-11') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.02/02/12/2024', '2024-02-12', 3, '2024-02-12', '2024-05-11', 6600000, 'Enam Juta Enam Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '101';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Kevin Pratama', '081211001103', '2024-03-01', '2024-05-31') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.03/03/01/2024', '2024-03-01', 3, '2024-03-01', '2024-05-31', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '102';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Dian Kusuma', '081211001104', '2024-05-10', '2024-08-09') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.04/05/10/2024', '2024-05-10', 3, '2024-05-10', '2024-08-09', 7500000, 'Tujuh Juta Lima Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '102';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Nadia Putri', '081211001105', '2024-07-01', '2024-09-30') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.05/07/01/2024', '2024-07-01', 3, '2024-07-01', '2024-09-30', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-02';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Fajar Nugroho', '081211001106', '2024-09-15', '2024-12-14') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.06/09/15/2024', '2024-09-15', 3, '2024-09-15', '2024-12-14', 6600000, 'Enam Juta Enam Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '103';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Maya Anggraini', '081211001107', '2024-11-01', '2024-12-31') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.07/11/01/2024', '2024-11-01', 2, '2024-11-01', '2024-12-31', 4000000, 'Empat Juta Rupiah');

    -- --- TAHUN 2025 ---
    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '104';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Arif Rahman', '081222002201', '2025-01-10', '2025-04-09') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.01/01/10/2025', '2025-01-10', 3, '2025-01-10', '2025-04-09', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '103';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Lukman Hakim', '081222002202', '2025-03-01', '2025-06-30') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.02/03/01/2025', '2025-03-01', 4, '2025-03-01', '2025-06-30', 10000000, 'Sepuluh Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '205';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Citra Lestari', '081222002203', '2025-05-05', '2025-08-04') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.03/05/05/2025', '2025-05-05', 3, '2025-05-05', '2025-08-04', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-01';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Bagus Setiawan', '081222002204', '2025-07-01', '2025-10-31') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.04/07/01/2025', '2025-07-01', 4, '2025-07-01', '2025-10-31', 8800000, 'Delapan Juta Delapan Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '207';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Dewi Kartika', '081222002205', '2025-09-12', '2025-12-11') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.05/09/12/2025', '2025-09-12', 3, '2025-09-12', '2025-12-11', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '101';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Ondo Al Huda', '081234567890', '2025-11-27', '2026-03-26') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.06/11/28/2025', '2025-11-28', 4, '2025-11-27', '2026-03-26', 10000000, 'Sepuluh Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '208';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Rina Marlina', '081222002206', '2025-12-01', '2026-02-28') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.07/12/01/2025', '2025-12-01', 3, '2025-12-01', '2026-02-28', 6000000, 'Enam Juta Rupiah');

    -- --- TAHUN 2026 ---
    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '102';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Budi Santoso', '081298765432', '2026-01-05', '2026-06-04') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.01/01/05/2026', '2026-01-05', 5, '2026-01-05', '2026-06-04', 12500000, 'Dua Belas Juta Lima Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-02';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Siti Aminah', '081345678901', '2026-02-10', '2026-05-09') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.02/02/10/2026', '2026-02-10', 3, '2026-02-10', '2026-05-09', 6600000, 'Enam Juta Enam Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '101';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Rizky Pratama', '087711223344', '2026-03-15', '2026-05-14') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.03/03/15/2026', '2026-03-15', 2, '2026-03-15', '2026-05-14', 4000000, 'Empat Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '102';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Ayu Lestari', '081333445566', '2026-04-02', '2026-07-01') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.04/04/02/2026', '2026-04-02', 3, '2026-04-02', '2026-07-01', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '202';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Doni Saputra', '081444556677', '2026-05-12', '2026-08-11') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.05/05/12/2026', '2026-05-12', 3, '2026-05-12', '2026-08-11', 7500000, 'Tujuh Juta Lima Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '103';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Tari Maharani', '081555667788', '2026-06-08', '2026-09-07') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.06/06/08/2026', '2026-06-08', 3, '2026-06-08', '2026-09-07', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-01';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Yoga Pratama', '081666778899', '2026-07-15', '2026-10-14') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.07/07/15/2026', '2026-07-15', 3, '2026-07-15', '2026-10-14', 6600000, 'Enam Juta Enam Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '209';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Vina Oktaviani', '081777889900', '2026-08-20', '2026-11-19') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.08/08/20/2026', '2026-08-20', 3, '2026-08-20', '2026-11-19', 6000000, 'Enam Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 1' AND kode_unit = '103';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Rendra Gunawan', '081888990011', '2026-09-05', '2026-12-04') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.09/09/05/2026', '2026-09-05', 3, '2026-09-05', '2026-12-04', 7500000, 'Tujuh Juta Lima Ratus Ribu Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '210';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Kiki Amelia', '081999001122', '2026-10-10', '2026-12-09') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.10/10/10/2026', '2026-10-10', 2, '2026-10-10', '2026-12-09', 4000000, 'Empat Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Kost' AND kode_unit = '206';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Diarsa Pandham Pawestri', '085612345678', '2026-11-01', '2026-11-30') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.11/11/01/2026', '2026-11-01', 1, '2026-11-01', '2026-11-30', 2000000, 'Dua Juta Rupiah');

    SELECT id INTO v_u FROM unit_hunian WHERE nama_cabang = 'Kakindi Griya 2' AND kode_unit = 'M-02';
    INSERT INTO penyewa (unit_id, nama_lengkap, no_telepon, tgl_mulai_sewa, tgl_selesai_sewa)
    VALUES (v_u, 'Salma Azzahra', '082111223344', '2026-11-15', '2027-01-14') RETURNING id INTO v_p;
    INSERT INTO pembayaran (penyewa_id, nomor_kuitansi, tgl_bayar, durasi_bulan, periode_mulai, periode_selesai, nominal, terbilang)
    VALUES (v_p, 'No.12/11/15/2026', '2026-11-15', 2, '2026-11-15', '2027-01-14', 4400000, 'Empat Juta Empat Ratus Ribu Rupiah');
END $$;

-- ==========================================
-- SEED DATA 3: PENGELUARAN (EXPENSE 2024 - 2026)
-- ==========================================
INSERT INTO pengeluaran (tgl_pengeluaran, nama_cabang, kategori, keterangan, nominal) VALUES
('2024-01-15', 'Kakindi Kost', 'Electricity', 'Token listrik area koridor & pompa air Januari 2024', 500000),
('2024-02-18', 'Kakindi Griya 1', 'Water', 'Tagihan PDAM Februari 2024', 320000),
('2024-03-20', 'Kakindi Griya 2', 'Perawatan', 'Perbaikan saluran air kamar mandi M-01', 275000),
('2024-05-14', 'Kakindi Kost', 'Electricity', 'Token listrik area kos Mei 2024', 550000),
('2024-07-16', 'Kakindi Griya 1', 'Perawatan', 'Cat ulang pagar & teras depan', 450000),
('2024-08-15', 'Kakindi Kost', 'Electricity', 'Token listrik area koridor & pompa air Agustus 2024', 450000),
('2024-08-20', 'Kakindi Kost', 'Water', 'Tagihan PDAM Agustus 2024', 300000),
('2024-11-10', 'Umum', 'Lain-lain', 'Perlengkapan kebersihan & alat tulis', 220000),
('2025-01-12', 'Kakindi Kost', 'Electricity', 'Token listrik Januari 2025', 520000),
('2025-03-14', 'Kakindi Griya 1', 'Water', 'Tagihan PDAM Maret 2025', 340000),
('2025-05-19', 'Kakindi Griya 2', 'Electricity', 'Token lampu taman & halaman M-01/M-02', 300000),
('2025-07-22', 'Kakindi Kost', 'Perawatan', 'Ganti lampu LED & servis kipas angin', 280000),
('2025-09-15', 'Kakindi Griya 1', 'Perawatan', 'Pembersihan tandon air & pipa', 360000),
('2025-11-10', 'Kakindi Griya 1', 'Perawatan', 'Service cuci AC 3 unit kamar 101', 350000),
('2025-11-15', 'Kakindi Griya 1', 'Electricity', 'Token listrik lampu luar & gerbang', 250000),
('2025-12-12', 'Kakindi Kost', 'Water', 'Tagihan PDAM Desember 2025', 350000),
('2026-01-12', 'Kakindi Griya 1', 'Water', 'Tagihan PDAM Januari 2026', 280000),
('2026-02-15', 'Kakindi Griya 2', 'Perawatan', 'Perbaikan keran air balkon M-01', 150000),
('2026-03-18', 'Kakindi Kost', 'Electricity', 'Token listrik Maret 2026', 600000),
('2026-04-16', 'Kakindi Griya 1', 'Electricity', 'Token listrik area kontrakan April 2026', 310000),
('2026-05-20', 'Kakindi Kost', 'Water', 'Tagihan PDAM Mei 2026', 340000),
('2026-06-18', 'Kakindi Griya 2', 'Water', 'Tagihan PDAM Juni 2026', 260000),
('2026-07-14', 'Kakindi Kost', 'Perawatan', 'Perbaikan kunci pintu & engsel kamar', 240000),
('2026-08-19', 'Kakindi Griya 1', 'Lain-lain', 'Iuran keamanan & sampah Agustus 2026', 250000),
('2026-09-17', 'Kakindi Kost', 'Electricity', 'Token listrik September 2026', 580000),
('2026-10-15', 'Kakindi Griya 2', 'Electricity', 'Token listrik Oktober 2026', 330000),
('2026-11-05', 'Kakindi Kost', 'Electricity', 'Token listrik November 2026', 650000),
('2026-11-10', 'Kakindi Kost', 'Water', 'Tagihan PDAM November 2026', 320000),
('2026-11-12', 'Umum', 'Lain-lain', 'Pembelian alat kebersihan & perlengkapan administrasi', 200000);