-- Bersihkan tabel lama jika ingin reset dari awal (opsional, hapus 5 baris ini jika ingin mempertahankan data lama)
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
    nama_cabang VARCHAR(100) NOT NULL, -- 'Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', dll.
    jenis_hunian VARCHAR(50) NOT NULL, -- 'Kontrakan Non-Mezzanine', 'Kontrakan Mezzanine', 'Kost'
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
    nama_cabang VARCHAR(100) NOT NULL, -- 'Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', atau 'Umum'
    kategori VARCHAR(80) NOT NULL,     -- 'Electricity', 'Water', 'Perawatan', 'Lain-lain'
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
-- A. Set Unit Terisi saat Penyewa Baru masuk
CREATE OR REPLACE FUNCTION set_unit_terisi()
RETURNS TRIGGER AS $$ BEGIN UPDATE unit_hunian SET status_tersedia = FALSE WHERE id = NEW.unit_id; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_penyewa_baru
AFTER INSERT ON penyewa
FOR EACH ROW EXECUTE FUNCTION set_unit_terisi();

-- B. Otomatis catat ke Jurnal Keuangan saat Pembayaran Sewa masuk
CREATE OR REPLACE FUNCTION log_jurnal_pembayaran()
RETURNS TRIGGER AS $$ DECLARE v_cabang VARCHAR(100); v_kode VARCHAR(20); v_nama VARCHAR(150); BEGIN SELECT u.nama_cabang, u.kode_unit, p.nama_lengkap INTO v_cabang, v_kode, v_nama FROM penyewa p JOIN unit_hunian u ON p.unit_id = u.id WHERE p.id = NEW.penyewa_id;      INSERT INTO jurnal_keuangan (tanggal, cabang, jenis_transaksi, akun, keterangan, debit, kredit, referensi_id) VALUES ( NEW.tgl_bayar, v_cabang, 'Pemasukan', 'Pendapatan Sewa Hunian', 'Sewa Unit ' \vert{}\vert{} v_kode \vert{}\vert{} ' (' \vert{}\vert{} v_nama \vert{}\vert{} ') - ' \vert{}\vert{} NEW.nomor_kuitansi, NEW.nominal, 0, NEW.id ); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jurnal_pembayaran
AFTER INSERT ON pembayaran
FOR EACH ROW EXECUTE FUNCTION log_jurnal_pembayaran();

-- C. Otomatis catat ke Jurnal Keuangan saat Pengeluaran dicatat
CREATE OR REPLACE FUNCTION log_jurnal_pengeluaran()
RETURNS TRIGGER AS $$ BEGIN INSERT INTO jurnal_keuangan (tanggal, cabang, jenis_transaksi, akun, keterangan, debit, kredit, referensi_id) VALUES ( NEW.tgl_pengeluaran, NEW.nama_cabang, 'Pengeluaran', 'Beban ' \vert{}\vert{} NEW.kategori, COALESCE(NEW.keterangan, NEW.kategori), 0, NEW.nominal, NEW.id ); RETURN NEW; END; $$ LANGUAGE plpgsql;

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
-- SEED DATA: DAFTAR KAMAR SESUAI CABANG
-- ==========================================
-- 1. Kakindi Griya 1 (Kamar 101, 102, 103, 202)
INSERT INTO unit_hunian (kode_unit, nama_cabang, jenis_hunian, harga_bulanan, daftar_fasilitas) VALUES
('101', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"AC 3/4PK","qty":1},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Tabung gas melon","qty":1},{"item":"Kompor gas","qty":1},{"item":"Gorden","qty":3},{"item":"Kloset duduk","qty":1},{"item":"Rak Sabun","qty":1},{"item":"Shower","qty":2}]'::jsonb),
('102', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb),
('103', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb),
('202', 'Kakindi Griya 1', 'Kontrakan Non-Mezzanine', 2500000, '[{"item":"AC 1/2PK","qty":2},{"item":"Meja + kursi makan","qty":1},{"item":"Kulkas","qty":1},{"item":"Kompor gas","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1}]'::jsonb);

-- 2. Kakindi Griya 2 (Kamar M-01, M-02)
INSERT INTO unit_hunian (kode_unit, nama_cabang, jenis_hunian, harga_bulanan, daftar_fasilitas) VALUES
('M-01', 'Kakindi Griya 2', 'Kontrakan Mezzanine', 2200000, '[{"item":"Dapur","qty":1},{"item":"Balkon / Area Cuci Jemur","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Parkir Mobil","qty":1}]'::jsonb),
('M-02', 'Kakindi Griya 2', 'Kontrakan Mezzanine', 2200000, '[{"item":"Dapur","qty":1},{"item":"Balkon / Area Cuci Jemur","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Parkir Mobil","qty":1}]'::jsonb);

-- 3. Kakindi Kost (Kamar 101, 102, 103, 104, 205, 206, 207, 208, 209, 210)
INSERT INTO unit_hunian (kode_unit, nama_cabang, jenis_hunian, harga_bulanan, daftar_fasilitas)
SELECT
    kode,
    'Kakindi Kost',
    'Kost',
    2000000,
    '[{"item":"Kasur 120x200 + Bantal","qty":1},{"item":"Lemari pakaian","qty":1},{"item":"Lemari buku","qty":1},{"item":"Meja","qty":1},{"item":"Kursi","qty":1},{"item":"AC 1/2PK","qty":1},{"item":"Kloset duduk","qty":1},{"item":"Shower","qty":1},{"item":"Rak Sabun","qty":1},{"item":"Gorden","qty":1}]'::jsonb
FROM unnest(ARRAY['101','102','103','104','205','206','207','208','209','210']) AS kode;