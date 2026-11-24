let allUnits = [];
let allPayments = [];
let allExpenses = [];
let allTenants = [];
let netIncomeChartInstance = null;
let statistikaChartInstances = [];
let propertiDateFilters = {};
let usingDummyMode = false;

const LOCAL_STORAGE_KEY = 'kakindi_dummy_store_v1';

// Logo SVG Kakindi Griya (sketsa rumah oranye & teks cokelat tua)
function getKakindiLogoSVG(extraClass = '') {
  return `
    <svg class="kakindi-logo-svg ${extraClass}" viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" aria-label="Logo Kakindi Griya">
      <!-- Sketsa Rumah Oranye -->
      <g fill="none" stroke="#F47A1F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <!-- Cerobong & Atap Utama -->
        <path d="M120 46 L120 26 L132 26 L132 42" />
        <path d="M98 76 L168 32 L242 74" />
        <path d="M108 72 L168 38 L232 70" />
        <!-- Dinding & Atap Samping Kiri -->
        <path d="M62 114 L104 86 L104 152 L62 152 Z" />
        <path d="M56 112 L104 80 L114 88" />
        <!-- Dinding Utama -->
        <path d="M104 152 L104 72 L168 38 L232 70 L232 152" />
        <!-- Atap & Teras Depan Kanan -->
        <path d="M202 106 L236 86 L272 108" />
        <path d="M208 106 L208 152 L266 152 L266 108" />
        <path d="M224 152 L224 122 Q237 112 250 122 L250 152" />
        <!-- Anak Tangga Teras -->
        <line x1="220" y1="152" x2="254" y2="152" />
        <line x1="216" y1="157" x2="258" y2="157" />
        <line x1="212" y1="162" x2="262" y2="162" />
        <!-- Jendela Atas -->
        <path d="M150 96 L150 74 Q162 62 174 74 L174 96 Z" />
        <line x1="162" y1="66" x2="162" y2="96" />
        <line x1="150" y1="82" x2="174" y2="82" />
        <path d="M196 96 L196 76 Q206 65 216 76 L216 96 Z" />
        <line x1="206" y1="69" x2="206" y2="96" />
        <!-- Jendela Bawah -->
        <rect x="76" y="114" width="16" height="24" />
        <line x1="84" y1="114" x2="84" y2="138" />
        <rect x="122" y="114" width="22" height="26" />
        <line x1="133" y1="114" x2="133" y2="140" />
        <rect x="162" y="114" width="22" height="26" />
        <line x1="173" y1="114" x2="173" y2="140" />
      </g>
      <!-- Teks Kakindi Griya -->
      <text x="180" y="154" text-anchor="middle" fill="#3B2314" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="500" letter-spacing="-0.5">
        Kakindi Griya
      </text>
    </svg>
  `;
}

// ==========================================
// 0. HELPER PENYIMPANAN DUMMY DATA (2024 - 2026)
// ==========================================
function getInitialDummyStore() {
  if (typeof DUMMY_DB === 'undefined') {
    return { units: [], tenants: [], payments: [], expenses: [] };
  }
  return JSON.parse(JSON.stringify(DUMMY_DB));
}

function loadLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.units) && parsed.units.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca localStorage, memuat ulang dari DUMMY_DB:', e);
  }
  const initial = getInitialDummyStore();
  saveLocalStore(initial);
  return initial;
}

function saveLocalStore(store) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Gagal menyimpan ke localStorage:', e);
  }
}

function hydrateDummyRelations(store) {
  const unitById = {};
  (store.units || []).forEach((u) => {
    unitById[u.id] = u;
  });

  const tenantById = {};
  (store.tenants || []).forEach((t) => {
    tenantById[t.id] = {
      ...t,
      unit_hunian: unitById[t.unit_id] || null
    };
  });

  allUnits = [...(store.units || [])].sort((a, b) =>
    String(a.kode_unit).localeCompare(String(b.kode_unit), undefined, { numeric: true })
  );
  allTenants = [...(store.tenants || [])];
  allPayments = [...(store.payments || [])]
    .map((p) => ({
      ...p,
      penyewa: tenantById[p.penyewa_id] || null
    }))
    .sort((a, b) => (a.tgl_bayar < b.tgl_bayar ? 1 : -1));
  allExpenses = [...(store.expenses || [])].sort((a, b) =>
    a.tgl_pengeluaran < b.tgl_pengeluaran ? 1 : -1
  );
}

async function resetDummyData() {
  if (!confirm('Reset seluruh data kembali ke data dummy Excel awal (2024–2026)?')) return;
  const fresh = getInitialDummyStore();
  saveLocalStore(fresh);
  usingDummyMode = true;
  await muatSemuaData();
  alert('Data dummy 2024–2026 berhasil di-reset!');
}

// ==========================================
// 1. SISTEM LOGIN KHUSUS PEMILIK (OWNER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-logo-container').innerHTML = getKakindiLogoSVG('login-size');
  document.getElementById('header-logo-container').innerHTML = getKakindiLogoSVG('header-size');

  initFilterTahunDanTanggal();
  cekStatusLogin();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.more-menu-wrapper')) {
      tutupSemuaDropdownProperti();
    }
  });
});

function cekStatusLogin() {
  const isLoggedIn = sessionStorage.getItem('kakindi_owner_auth') === 'true';
  if (isLoggedIn) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    muatSemuaData();
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  }
}

document.getElementById('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;

  if (user === OWNER_CREDENTIALS.username && pass === OWNER_CREDENTIALS.password) {
    sessionStorage.setItem('kakindi_owner_auth', 'true');
    document.getElementById('login-error').classList.add('hidden');
    cekStatusLogin();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
});

function logoutOwner() {
  sessionStorage.removeItem('kakindi_owner_auth');
  cekStatusLogin();
}

// ==========================================
// 2. NAVIGASI MENU KANAN (FILTER PERIODE HANYA DI DASHBOARD)
// ==========================================
function bukaMenu(viewId, btnElement) {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');

  document.querySelectorAll('.nav-icon-btn').forEach((btn) => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const periodFilter = document.getElementById('dashboard-period-filter');
  if (viewId === 'view-dashboard') {
    periodFilter.classList.remove('hidden');
  } else {
    periodFilter.classList.add('hidden');
  }

  if (viewId === 'view-statistika') {
    renderStatistikaCharts();
  }
}

function initFilterTahunDanTanggal() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = now.toISOString().split('T')[0];

  const selectTahun = document.getElementById('filter-tahun');
  selectTahun.innerHTML = '';
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    selectTahun.appendChild(opt);
  }

  const selectStatTahun = document.getElementById('stat-filter-tahun');
  if (selectStatTahun) {
    selectStatTahun.innerHTML = '';
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      selectStatTahun.appendChild(opt);
    }
  }

  document.getElementById('filter-bulan').value = currentMonth;
  document.getElementById('avail-start').value = todayStr;
  document.getElementById('avail-end').value = todayStr;
  document.getElementById('tgl_bayar').value = todayStr;
  document.getElementById('periode_mulai').value = todayStr;
  document.getElementById('exp_tanggal').value = todayStr;
  hitungTanggalSelesai();
}

function toggleSelectBulan() {
  const tipe = document.getElementById('filter-tipe-periode').value;
  const bulanEl = document.getElementById('filter-bulan');
  if (tipe === 'tahunan') {
    bulanEl.classList.add('hidden');
  } else {
    bulanEl.classList.remove('hidden');
  }
}

// ==========================================
// 3. MUAT SELURUH DATA (SUPABASE + FALLBACK DUMMY EXCEL 2024-2026)
// ==========================================
async function muatSemuaData() {
  let loadedFromSupabase = false;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const [resUnits, resTenants, resPayments, resExpenses] = await Promise.all([
        supabaseClient.from('unit_hunian').select('*').order('kode_unit', { ascending: true }),
        supabaseClient.from('penyewa').select('*'),
        supabaseClient.from('pembayaran').select('*, penyewa(*, unit_hunian(*))').order('tgl_bayar', { ascending: false }),
        supabaseClient.from('pengeluaran').select('*').order('tgl_pengeluaran', { ascending: false })
      ]);

      if (!resUnits.error && Array.isArray(resUnits.data) && resUnits.data.length > 0 && Array.isArray(resPayments.data) && resPayments.data.length > 0) {
        allUnits = resUnits.data;
        allTenants = resTenants.data || [];
        allPayments = resPayments.data || [];
        allExpenses = resExpenses.data || [];
        loadedFromSupabase = true;
        usingDummyMode = false;
      }
    } catch (err) {
      console.warn('Supabase tidak terhubung / kosong, beralih ke Dummy Data Excel:', err);
    }
  }

  if (!loadedFromSupabase) {
    usingDummyMode = true;
    const store = loadLocalStore();
    hydrateDummyRelations(store);
  }

  const badge = document.getElementById('data-source-badge');
  if (badge) {
    badge.textContent = usingDummyMode ? 'Mode Dummy Excel (2024–2026)' : 'Live Supabase';
  }

  muatDashboard();
  renderDropdownUnit();
  renderTabelProperti();
  renderTabelPembayaran();
  muatJurnal();
}

// ==========================================
// 4. RENDER DASHBOARD UTAMA
// ==========================================
function muatDashboard() {
  const tipePeriode = document.getElementById('filter-tipe-periode').value;
  const bulan = parseInt(document.getElementById('filter-bulan').value, 10);
  const tahun = parseInt(document.getElementById('filter-tahun').value, 10);

  const namaBulan = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const labelPeriode = tipePeriode === 'bulanan' ? `(${namaBulan[bulan]} ${tahun})` : `(Tahun ${tahun})`;
  document.getElementById('label-periode-income').textContent = labelPeriode;
  document.getElementById('label-periode-expense').textContent = labelPeriode;
  document.getElementById('chart-year-label').textContent = tahun;

  const filterByDate = (dateStr) => {
    const [y, m] = String(dateStr).split('-').map(Number);
    if (tipePeriode === 'tahunan') return y === tahun;
    return y === tahun && m === bulan;
  };

  const filteredPayments = allPayments.filter((p) => filterByDate(p.tgl_bayar));
  const filteredExpenses = allExpenses.filter((e) => filterByDate(e.tgl_pengeluaran));

  const daftarCabang = [...new Set(['Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', ...allUnits.map((u) => u.nama_cabang)])];
  const incomeContainer = document.getElementById('list-income-cabang');
  incomeContainer.innerHTML = '';

  let totalIncomePeriode = 0;
  daftarCabang.forEach((cabang) => {
    const sum = filteredPayments
      .filter((p) => p.penyewa?.unit_hunian?.nama_cabang === cabang)
      .reduce((acc, cur) => acc + Number(cur.nominal), 0);
    totalIncomePeriode += sum;

    incomeContainer.innerHTML += `
      <div class="summary-row-item">
        <span>${cabang}</span>
        <strong>${formatRupiah(sum)}</strong>
      </div>
    `;
  });

  const kategoriList = ['Electricity', 'Water', 'Perawatan', 'Lain-lain'];
  const expenseContainer = document.getElementById('list-expense-kategori');
  expenseContainer.innerHTML = '';

  let totalExpensePeriode = 0;
  kategoriList.forEach((kat) => {
    const sum = filteredExpenses
      .filter((e) => e.kategori === kat)
      .reduce((acc, cur) => acc + Number(cur.nominal), 0);
    totalExpensePeriode += sum;

    expenseContainer.innerHTML += `
      <div class="summary-row-item">
        <span>${kat}</span>
        <strong>${formatRupiah(sum)}</strong>
      </div>
    `;
  });

  const netPeriode = totalIncomePeriode - totalExpensePeriode;
  document.getElementById('total-net-income-display').textContent = formatRupiah(netPeriode);

  renderRoomAvailable();
  renderNetIncomeChart(tahun);

  if (!document.getElementById('view-statistika').classList.contains('hidden')) {
    renderStatistikaCharts();
  }
}

function renderRoomAvailable() {
  const startStr = document.getElementById('avail-start').value;
  const endStr = document.getElementById('avail-end').value;

  const daftarCabang = [...new Set(['Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', ...allUnits.map((u) => u.nama_cabang)])];
  const container = document.getElementById('room-available-columns');
  container.innerHTML = '';

  daftarCabang.forEach((cabang) => {
    const unitsInBranch = allUnits.filter((u) => u.nama_cabang === cabang);
    const listHTML = unitsInBranch
      .map((unit) => {
        const isBookedInRange = allTenants.some((t) => {
          if (t.unit_id !== unit.id) return false;
          if (!startStr || !endStr) return !unit.status_tersedia;
          return t.tgl_mulai_sewa <= endStr && t.tgl_selesai_sewa >= startStr;
        });

        const terisi = startStr && endStr ? isBookedInRange : !unit.status_tersedia;
        return `<li class="${terisi ? 'booked' : ''}" title="${terisi ? 'Terisi' : 'Tersedia'}">${unit.kode_unit}</li>`;
      })
      .join('');

    container.innerHTML += `
      <div class="room-col-box">
        <div class="room-col-header">${cabang.toUpperCase()}</div>
        <ul class="room-list">${listHTML || '<li>-</li>'}</ul>
      </div>
    `;
  });
}

function renderNetIncomeChart(tahun) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const netPerBulan = Array(12).fill(0);

  allPayments.forEach((p) => {
    const [y, m] = String(p.tgl_bayar).split('-').map(Number);
    if (y === tahun) {
      netPerBulan[m - 1] += Number(p.nominal);
    }
  });

  allExpenses.forEach((e) => {
    const [y, m] = String(e.tgl_pengeluaran).split('-').map(Number);
    if (y === tahun) {
      netPerBulan[m - 1] -= Number(e.nominal);
    }
  });

  const ctx = document.getElementById('netIncomeChart').getContext('2d');
  if (netIncomeChartInstance) {
    netIncomeChartInstance.destroy();
  }

  netIncomeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Net Income ${tahun} (Rp)`,
          data: netPerBulan,
          backgroundColor: '#930031',
          borderColor: '#FFA500',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            callback: (val) => 'Rp' + (val / 1000000).toFixed(1) + 'jt'
          }
        }
      }
    }
  });
}

// ==========================================
// 5. MENU STATISTIKA PER CABANG (SESUAI SKETSA)
// ==========================================
function renderStatistikaCharts() {
  const tahunEl = document.getElementById('stat-filter-tahun');
  const tahun = tahunEl ? parseInt(tahunEl.value, 10) : new Date().getFullYear();
  const container = document.getElementById('statistika-cabang-container');
  if (!container) return;

  statistikaChartInstances.forEach((chart) => chart.destroy());
  statistikaChartInstances = [];
  container.innerHTML = '';

  const daftarCabang = [...new Set(['Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', ...allUnits.map((u) => u.nama_cabang)])];
  const labelsBulan = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

  daftarCabang.forEach((cabang, idx) => {
    const incomeBulanan = Array(12).fill(0);
    const expenseBulanan = Array(12).fill(0);

    allPayments.forEach((p) => {
      if (p.penyewa?.unit_hunian?.nama_cabang === cabang) {
        const [y, m] = String(p.tgl_bayar).split('-').map(Number);
        if (y === tahun) {
          incomeBulanan[m - 1] += Number(p.nominal);
        }
      }
    });

    allExpenses.forEach((e) => {
      if (e.nama_cabang === cabang) {
        const [y, m] = String(e.tgl_pengeluaran).split('-').map(Number);
        if (y === tahun) {
          expenseBulanan[m - 1] += Number(e.nominal);
        }
      }
    });

    const netBulanan = incomeBulanan.map((inc, i) => inc - expenseBulanan[i]);

    const card = document.createElement('div');
    card.className = 'panel-card';
    card.innerHTML = `
      <div class="prop-branch-header">
        <div class="prop-branch-title-group">
          <h3>${cabang.toUpperCase()}</h3>
        </div>
        <span class="year-pill">${tahun}</span>
      </div>
      <div class="stat-branch-charts">
        <div class="stats-chart-box">
          <h4>INCOME VS EXPENSE</h4>
          <div class="chart-container small-chart">
            <canvas id="stat-ie-${idx}"></canvas>
          </div>
        </div>
        <div class="stats-chart-box">
          <h4>NET INCOME</h4>
          <div class="chart-container small-chart">
            <canvas id="stat-net-${idx}"></canvas>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    const ctxIE = document.getElementById(`stat-ie-${idx}`).getContext('2d');
    const chartIE = new Chart(ctxIE, {
      type: 'bar',
      data: {
        labels: labelsBulan,
        datasets: [
          {
            label: 'Income',
            data: incomeBulanan,
            backgroundColor: '#930031',
            borderRadius: 4
          },
          {
            label: 'Expense',
            data: expenseBulanan,
            backgroundColor: '#FFA500',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (val) => 'Rp' + (val / 1000000).toFixed(1) + 'jt'
            }
          }
        }
      }
    });

    const ctxNet = document.getElementById(`stat-net-${idx}`).getContext('2d');
    const chartNet = new Chart(ctxNet, {
      type: 'bar',
      data: {
        labels: labelsBulan,
        datasets: [
          {
            label: 'Net Income',
            data: netBulanan,
            backgroundColor: '#930031',
            borderColor: '#FFA500',
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (val) => 'Rp' + (val / 1000000).toFixed(1) + 'jt'
            }
          }
        }
      }
    });

    statistikaChartInstances.push(chartIE, chartNet);
  });
}

// ==========================================
// 6. MENU ADD PROPERTI & KAMAR (POP-UP '+', EDIT & DELETE DI TITIK 3 '⋮')
// ==========================================
function bukaModalTambahProperti() {
  document.getElementById('modal-tambah-properti').classList.remove('hidden');
}

function tutupModalProperti() {
  document.getElementById('modal-tambah-properti').classList.add('hidden');
}

function toggleDropdownProperti(idx, event) {
  event.stopPropagation();
  const targetMenu = document.getElementById(`prop-dropdown-${idx}`);
  const isCurrentlyHidden = targetMenu.classList.contains('hidden');

  tutupSemuaDropdownProperti();
  if (isCurrentlyHidden) {
    targetMenu.classList.remove('hidden');
  }
}

function tutupSemuaDropdownProperti() {
  document.querySelectorAll('.more-dropdown-menu').forEach((menu) => {
    menu.classList.add('hidden');
  });
}

document.getElementById('form-properti').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cabang = document.getElementById('prop_cabang').value.trim();
  const jenis = document.getElementById('prop_jenis').value;
  const kamarRaw = document.getElementById('prop_kamar').value;
  const harga = Number(document.getElementById('prop_harga').value);

  const daftarKamar = kamarRaw.split(',').map((k) => k.trim()).filter(Boolean);
  const defaultFasilitas =
    jenis === 'Kost'
      ? [
          { item: 'Kasur 120x200 + Bantal', qty: 1 },
          { item: 'Lemari pakaian', qty: 1 },
          { item: 'Meja & Kursi', qty: 1 },
          { item: 'Kloset duduk', qty: 1 },
          { item: 'Shower', qty: 1 }
        ]
      : [
          { item: 'AC', qty: 1 },
          { item: 'Dapur', qty: 1 },
          { item: 'Kloset duduk', qty: 1 },
          { item: 'Shower', qty: 1 }
        ];

  const rows = daftarKamar.map((kode, i) => ({
    id: `unit-${Date.now()}-${i}`,
    nama_cabang: cabang,
    kode_unit: kode,
    jenis_hunian: jenis,
    harga_bulanan: harga,
    status_tersedia: true,
    daftar_fasilitas: defaultFasilitas
  }));

  if (usingDummyMode) {
    const store = loadLocalStore();
    store.units.push(...rows);
    saveLocalStore(store);
  } else {
    const dbRows = rows.map(({ id, ...rest }) => rest);
    const { error } = await supabaseClient.from('unit_hunian').insert(dbRows);
    if (error) {
      alert('Gagal menambah properti: ' + error.message);
      return;
    }
  }

  alert(`Berhasil menambahkan ${rows.length} kamar pada ${cabang}!`);
  e.target.reset();
  tutupModalProperti();
  await muatSemuaData();
});

function ubahFilterTanggalProperti(cabang, tipe, nilai) {
  if (!propertiDateFilters[cabang]) {
    const todayStr = new Date().toISOString().split('T')[0];
    propertiDateFilters[cabang] = { start: todayStr, end: todayStr };
  }
  propertiDateFilters[cabang][tipe] = nilai;
  renderTabelProperti();
}

function renderTabelProperti() {
  const container = document.getElementById('properti-cabang-container');
  if (!container) return;
  container.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const daftarCabang = [...new Set(['Kakindi Griya 1', 'Kakindi Griya 2', 'Kakindi Kost', ...allUnits.map((u) => u.nama_cabang)])];

  daftarCabang.forEach((cabang, idx) => {
    if (!propertiDateFilters[cabang]) {
      propertiDateFilters[cabang] = { start: todayStr, end: todayStr };
    }
    const { start, end } = propertiDateFilters[cabang];
    const unitsInBranch = allUnits.filter((u) => u.nama_cabang === cabang);

    const availableUnits = [];
    const rentedUnits = [];

    unitsInBranch.forEach((unit) => {
      const tenantAktif = allTenants.find((t) => {
        if (t.unit_id !== unit.id) return false;
        if (!start || !end) return !unit.status_tersedia;
        return t.tgl_mulai_sewa <= end && t.tgl_selesai_sewa >= start;
      });

      const isRented = start && end ? Boolean(tenantAktif) : !unit.status_tersedia;
      if (isRented) {
        rentedUnits.push({ unit, tenant: tenantAktif });
      } else {
        availableUnits.push(unit);
      }
    });

    const availableHTML = availableUnits.length
      ? availableUnits
          .map(
            (u) => `
            <li>
              <span>- Kamar ${u.kode_unit}</span>
              <small>${formatRupiah(u.harga_bulanan)}/bln</small>
            </li>`
          )
          .join('')
      : '<li><small>Tidak ada kamar kosong</small></li>';

    const rentedHTML = rentedUnits.length
      ? rentedUnits
          .map(
            ({ unit, tenant }) => `
            <li class="rented-item">
              <span>- Kamar ${unit.kode_unit}</span>
              <small>${tenant ? tenant.nama_lengkap : 'Terisi'}</small>
            </li>`
          )
          .join('')
      : '<li><small>Belum ada kamar terisi</small></li>';

    const escapedCabang = cabang.replace(/'/g, "\'");
    const card = document.createElement('div');
    card.className = 'panel-card';
    card.innerHTML = `
      <div class="prop-branch-header">
        <div class="prop-branch-title-group">
          <h3>${cabang.toUpperCase()}</h3>
          <div class="date-range-filter">
            <input type="date" value="${start}" onchange="ubahFilterTanggalProperti('${escapedCabang}', 'start', this.value)" />
            <span>-</span>
            <input type="date" value="${end}" onchange="ubahFilterTanggalProperti('${escapedCabang}', 'end', this.value)" />
          </div>
        </div>
        <div class="more-menu-wrapper">
          <button class="more-dots-btn" onclick="toggleDropdownProperti(${idx}, event)" title="Opsi Properti ${cabang}">⋮</button>
          <div id="prop-dropdown-${idx}" class="more-dropdown-menu hidden">
            <button type="button" class="more-dropdown-item" onclick="tutupSemuaDropdownProperti(); bukaModalEditProperti('${escapedCabang}')">
              ✏️ Edit Property
            </button>
            <button type="button" class="more-dropdown-item delete-item" onclick="tutupSemuaDropdownProperti(); hapusPropertiCabang('${escapedCabang}')">
              🗑️ Delete Property
            </button>
          </div>
        </div>
      </div>

      <div class="avail-rented-grid">
        <div class="status-col-box">
          <div class="status-col-title">AVAILABLE (${availableUnits.length})</div>
          <ul class="status-unit-list">${availableHTML}</ul>
        </div>
        <div class="status-col-box">
          <div class="status-col-title">RENTED (${rentedUnits.length})</div>
          <ul class="status-unit-list">${rentedHTML}</ul>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function hapusPropertiCabang(cabang) {
  const units = allUnits.filter((u) => u.nama_cabang === cabang);
  if (units.length === 0) {
    alert(`Properti "${cabang}" tidak memiliki unit kamar untuk dihapus.`);
    return;
  }

  const konfirmasi = confirm(
    `Yakin ingin menghapus seluruh properti "${cabang}" (${units.length} unit kamar)?
Tindakan ini tidak dapat dibatalkan.`
  );
  if (!konfirmasi) return;

  if (usingDummyMode) {
    const store = loadLocalStore();
    const deletedUnitIds = new Set(store.units.filter((u) => u.nama_cabang === cabang).map((u) => u.id));
    store.units = store.units.filter((u) => u.nama_cabang !== cabang);
    const deletedTenantIds = new Set(store.tenants.filter((t) => deletedUnitIds.has(t.unit_id)).map((t) => t.id));
    store.tenants = store.tenants.filter((t) => !deletedUnitIds.has(t.unit_id));
    store.payments = store.payments.filter((p) => !deletedTenantIds.has(p.penyewa_id));
    saveLocalStore(store);
  } else {
    const { error } = await supabaseClient
      .from('unit_hunian')
      .delete()
      .eq('nama_cabang', cabang);

    if (error) {
      alert(
        `Gagal menghapus properti "${cabang}": ${error.message}

Catatan: Properti yang memiliki unit dengan riwayat penyewa/kuitansi tidak dapat dihapus langsung.`
      );
      return;
    }
  }

  delete propertiDateFilters[cabang];
  alert(`Properti "${cabang}" berhasil dihapus.`);
  await muatSemuaData();
}

function bukaModalEditProperti(cabang) {
  const units = allUnits.filter((u) => u.nama_cabang === cabang);
  const sample = units[0] || { jenis_hunian: 'Kontrakan Non-Mezzanine', harga_bulanan: 2000000 };
  const escapedCabang = cabang.replace(/'/g, "\'");

  document.getElementById('edit-prop-modal-title').textContent = `Edit Properti — ${cabang}`;
  document.getElementById('edit_cabang_lama').value = cabang;
  document.getElementById('edit_cabang_baru').value = cabang;
  document.getElementById('edit_jenis_hunian').value = sample.jenis_hunian;
  document.getElementById('edit_harga_bulanan').value = sample.harga_bulanan;
  document.getElementById('edit_tambah_kamar').value = '';

  const tbody = document.getElementById('edit-prop-kamar-tbody');
  tbody.innerHTML = '';
  units.forEach((u) => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${u.kode_unit}</strong></td>
        <td>${formatRupiah(u.harga_bulanan)}</td>
        <td>${u.status_tersedia ? 'Available' : 'Rented'}</td>
        <td style="display:flex; gap:6px;">
          ${
            !u.status_tersedia
              ? `<button type="button" class="btn btn-secondary" onclick="kosongkanUnitDariEdit('${u.id}', '${escapedCabang}')">Set Available</button>`
              : ''
          }
          <button type="button" class="btn btn-danger" onclick="hapusUnit('${u.id}', '${escapedCabang}')">Hapus</button>
        </td>
      </tr>
    `;
  });

  document.getElementById('modal-edit-properti').classList.remove('hidden');
}

function tutupModalEditProperti() {
  document.getElementById('modal-edit-properti').classList.add('hidden');
}

document.getElementById('form-edit-properti').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cabangLama = document.getElementById('edit_cabang_lama').value;
  const cabangBaru = document.getElementById('edit_cabang_baru').value.trim();
  const jenisBaru = document.getElementById('edit_jenis_hunian').value;
  const hargaBaru = Number(document.getElementById('edit_harga_bulanan').value);
  const kamarBaruRaw = document.getElementById('edit_tambah_kamar').value;

  const daftarKamarBaru = kamarBaruRaw.split(',').map((k) => k.trim()).filter(Boolean);
  const defaultFasilitas =
    jenisBaru === 'Kost'
      ? [
          { item: 'Kasur 120x200 + Bantal', qty: 1 },
          { item: 'Lemari pakaian', qty: 1 },
          { item: 'Meja & Kursi', qty: 1 },
          { item: 'Kloset duduk', qty: 1 },
          { item: 'Shower', qty: 1 }
        ]
      : [
          { item: 'AC', qty: 1 },
          { item: 'Dapur', qty: 1 },
          { item: 'Kloset duduk', qty: 1 },
          { item: 'Shower', qty: 1 }
        ];

  if (usingDummyMode) {
    const store = loadLocalStore();
    store.units = store.units.map((u) =>
      u.nama_cabang === cabangLama
        ? { ...u, nama_cabang: cabangBaru, jenis_hunian: jenisBaru, harga_bulanan: hargaBaru }
        : u
    );
    daftarKamarBaru.forEach((kode, i) => {
      store.units.push({
        id: `unit-${Date.now()}-${i}`,
        nama_cabang: cabangBaru,
        kode_unit: kode,
        jenis_hunian: jenisBaru,
        harga_bulanan: hargaBaru,
        status_tersedia: true,
        daftar_fasilitas: defaultFasilitas
      });
    });
    saveLocalStore(store);
  } else {
    const { error: errUpdate } = await supabaseClient
      .from('unit_hunian')
      .update({
        nama_cabang: cabangBaru,
        jenis_hunian: jenisBaru,
        harga_bulanan: hargaBaru
      })
      .eq('nama_cabang', cabangLama);

    if (errUpdate) {
      alert('Gagal memperbarui properti: ' + errUpdate.message);
      return;
    }

    if (daftarKamarBaru.length > 0) {
      const newRows = daftarKamarBaru.map((kode) => ({
        nama_cabang: cabangBaru,
        kode_unit: kode,
        jenis_hunian: jenisBaru,
        harga_bulanan: hargaBaru,
        status_tersedia: true,
        daftar_fasilitas: defaultFasilitas
      }));

      const { error: errInsert } = await supabaseClient.from('unit_hunian').insert(newRows);
      if (errInsert) {
        alert('Cabang diperbarui, namun gagal menambah kamar baru: ' + errInsert.message);
      }
    }
  }

  alert('Perubahan properti berhasil disimpan!');
  tutupModalEditProperti();
  await muatSemuaData();
});

async function kosongkanUnitDariEdit(id, cabang) {
  if (usingDummyMode) {
    const store = loadLocalStore();
    store.units = store.units.map((u) => (u.id === id ? { ...u, status_tersedia: true } : u));
    saveLocalStore(store);
  } else {
    await supabaseClient.from('unit_hunian').update({ status_tersedia: true }).eq('id', id);
  }
  await muatSemuaData();
  bukaModalEditProperti(cabang);
}

async function hapusUnit(id, cabang) {
  if (!confirm('Yakin ingin menghapus kamar ini?')) return;
  if (usingDummyMode) {
    const store = loadLocalStore();
    store.units = store.units.filter((u) => u.id !== id);
    saveLocalStore(store);
  } else {
    const { error } = await supabaseClient.from('unit_hunian').delete().eq('id', id);
    if (error) {
      alert('Tidak bisa menghapus kamar karena sudah memiliki riwayat penyewa.');
      return;
    }
  }
  await muatSemuaData();
  bukaModalEditProperti(cabang);
}

// ==========================================
// 7. MENU PENGELUARAN & JURNAL
// ==========================================
document.getElementById('form-pengeluaran').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id: `exp-${Date.now()}`,
    tgl_pengeluaran: document.getElementById('exp_tanggal').value,
    nama_cabang: document.getElementById('exp_cabang').value,
    kategori: document.getElementById('exp_kategori').value,
    nominal: Number(document.getElementById('exp_nominal').value),
    keterangan: document.getElementById('exp_keterangan').value.trim()
  };

  if (usingDummyMode) {
    const store = loadLocalStore();
    store.expenses.unshift(payload);
    saveLocalStore(store);
  } else {
    const { id, ...dbPayload } = payload;
    const { error } = await supabaseClient.from('pengeluaran').insert([dbPayload]);
    if (error) {
      alert('Gagal mencatat pengeluaran: ' + error.message);
      return;
    }
  }

  alert('Pengeluaran berhasil disimpan.');
  e.target.reset();
  document.getElementById('exp_tanggal').value = new Date().toISOString().split('T')[0];
  await muatSemuaData();
});

async function muatJurnal() {
  const tbody = document.getElementById('tabel-jurnal-body');
  tbody.innerHTML = '';

  if (usingDummyMode) {
    const jurnalRows = [];
    allPayments.forEach((p) => {
      const unit = p.penyewa?.unit_hunian;
      jurnalRows.push({
        tanggal: p.tgl_bayar,
        cabang: unit?.nama_cabang || '-',
        jenis_transaksi: 'Pemasukan',
        akun: 'Pendapatan Sewa Hunian',
        keterangan: `Sewa Unit ${unit?.kode_unit || '-'} (${p.penyewa?.nama_lengkap || '-'}) - ${p.nomor_kuitansi}`,
        debit: Number(p.nominal),
        kredit: 0
      });
    });

    allExpenses.forEach((e) => {
      jurnalRows.push({
        tanggal: e.tgl_pengeluaran,
        cabang: e.nama_cabang,
        jenis_transaksi: 'Pengeluaran',
        akun: `Beban ${e.kategori}`,
        keterangan: e.keterangan || e.kategori,
        debit: 0,
        kredit: Number(e.nominal)
      });
    });

    jurnalRows.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
    jurnalRows.forEach((row) => {
      tbody.innerHTML += `
        <tr>
          <td>${formatTanggalIndo(row.tanggal)}</td>
          <td>${row.cabang}</td>
          <td><strong>${row.jenis_transaksi}</strong></td>
          <td>${row.akun}</td>
          <td>${row.keterangan}</td>
          <td>${row.debit > 0 ? formatRupiah(row.debit) : '-'}</td>
          <td>${row.kredit > 0 ? formatRupiah(row.kredit) : '-'}</td>
        </tr>
      `;
    });
    return;
  }

  const { data } = await supabaseClient
    .from('jurnal_keuangan')
    .select('*')
    .order('tanggal', { ascending: false });

  (data || []).forEach((row) => {
    tbody.innerHTML += `
      <tr>
        <td>${formatTanggalIndo(row.tanggal)}</td>
        <td>${row.cabang}</td>
        <td><strong>${row.jenis_transaksi}</strong></td>
        <td>${row.akun}</td>
        <td>${row.keterangan}</td>
        <td>${row.debit > 0 ? formatRupiah(row.debit) : '-'}</td>
        <td>${row.kredit > 0 ? formatRupiah(row.kredit) : '-'}</td>
      </tr>
    `;
  });
}

// ==========================================
// 8. MENU KUITANSI & TRANSAKSI SEWA
// ==========================================
function renderDropdownUnit() {
  const select = document.getElementById('select_unit');
  select.innerHTML = '';
  const tersedia = allUnits.filter((u) => u.status_tersedia);

  if (tersedia.length === 0) {
    select.innerHTML = '<option value="">Semua kamar terisi (Set Available di Add Properti untuk sewa baru)</option>';
    return;
  }

  tersedia.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.nama_cabang} — Kamar ${u.kode_unit} (${formatRupiah(u.harga_bulanan)}/bln)`;
    select.appendChild(opt);
  });
  hitungTotal();
}

function hitungTanggalSelesai() {
  const mulaiVal = document.getElementById('periode_mulai').value;
  const durasi = parseInt(document.getElementById('durasi_bulan').value || '1', 10);
  if (!mulaiVal) return;

  const [y, m, d] = mulaiVal.split('-').map(Number);
  const dt = new Date(y, m - 1 + durasi, d - 1);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  document.getElementById('periode_selesai').value = `${yyyy}-${mm}-${dd}`;
}

function hitungTotal() {
  const unitId = document.getElementById('select_unit').value;
  const durasi = parseInt(document.getElementById('durasi_bulan').value || '1', 10);
  const unit = allUnits.find((u) => u.id === unitId);
  if (unit) {
    document.getElementById('nominal').value = unit.harga_bulanan * durasi;
  }
}

document.getElementById('form-transaksi').addEventListener('submit', async (e) => {
  e.preventDefault();
  const unitId = document.getElementById('select_unit').value;
  const unit = allUnits.find((u) => u.id === unitId);
  if (!unit) return alert('Pilih kamar yang tersedia terlebih dahulu.');

  const namaLengkap = document.getElementById('nama_lengkap').value.trim();
  const noTelepon = document.getElementById('no_telepon').value.trim();
  const tglBayar = document.getElementById('tgl_bayar').value;
  const periodeMulai = document.getElementById('periode_mulai').value;
  const periodeSelesai = document.getElementById('periode_selesai').value;
  const durasiBulan = parseInt(document.getElementById('durasi_bulan').value, 10);
  const nominal = Number(document.getElementById('nominal').value);
  const penerima = document.getElementById('penerima').value.trim();

  const [yr] = tglBayar.split('-');
  const nomorKuitansi = `KKT-${yr}-${String(allPayments.length + 1).padStart(4, '0')}`;

  if (usingDummyMode) {
    const store = loadLocalStore();
    const penyewaData = {
      id: `tenant-${Date.now()}`,
      unit_id: unit.id,
      nama_lengkap: namaLengkap,
      no_telepon: noTelepon,
      tgl_mulai_sewa: periodeMulai,
      tgl_selesai_sewa: periodeSelesai
    };
    const bayarData = {
      id: `pay-${Date.now()}`,
      penyewa_id: penyewaData.id,
      nomor_kuitansi: nomorKuitansi,
      tgl_bayar: tglBayar,
      durasi_bulan: durasiBulan,
      periode_mulai: periodeMulai,
      periode_selesai: periodeSelesai,
      nominal: nominal,
      terbilang: `${terbilang(nominal)} Rupiah`,
      penerima: penerima
    };
    store.tenants.push(penyewaData);
    store.payments.unshift(bayarData);
    store.units = store.units.map((u) => (u.id === unit.id ? { ...u, status_tersedia: false } : u));
    saveLocalStore(store);

    e.target.reset();
    await muatSemuaData();
    bukaKuitansi({ pembayaran: bayarData, penyewa: penyewaData, unit });
    return;
  }

  const { data: penyewaData, error: errP } = await supabaseClient
    .from('penyewa')
    .insert([{ unit_id: unit.id, nama_lengkap: namaLengkap, no_telepon: noTelepon, tgl_mulai_sewa: periodeMulai, tgl_selesai_sewa: periodeSelesai }])
    .select()
    .single();

  if (errP) return alert('Gagal simpan penyewa: ' + errP.message);

  const { data: bayarData, error: errB } = await supabaseClient
    .from('pembayaran')
    .insert([{
      penyewa_id: penyewaData.id,
      nomor_kuitansi: nomorKuitansi,
      tgl_bayar: tglBayar,
      durasi_bulan: durasiBulan,
      periode_mulai: periodeMulai,
      periode_selesai: periodeSelesai,
      nominal: nominal,
      terbilang: `${terbilang(nominal)} Rupiah`,
      penerima: penerima
    }])
    .select()
    .single();

  if (errB) return alert('Gagal simpan pembayaran: ' + errB.message);

  e.target.reset();
  await muatSemuaData();
  bukaKuitansi({ pembayaran: bayarData, penyewa: penyewaData, unit });
});

function renderTabelPembayaran() {
  const tbody = document.getElementById('tabel-pembayaran-body');
  tbody.innerHTML = '';

  allPayments.forEach((item, idx) => {
    const penyewa = item.penyewa;
    const unit = penyewa?.unit_hunian;
    if (!unit) return;

    tbody.innerHTML += `
      <tr>
        <td><strong>${item.nomor_kuitansi}</strong></td>
        <td>${formatTanggalIndo(item.tgl_bayar)}</td>
        <td>${penyewa.nama_lengkap}</td>
        <td>${unit.nama_cabang} — Unit ${unit.kode_unit}</td>
        <td>${formatRupiah(item.nominal)}</td>
        <td>
          <button class="btn btn-primary" onclick="bukaKuitansiByIndex(${idx})">Lihat Kuitansi</button>
        </td>
      </tr>
    `;
  });
}

function bukaKuitansiByIndex(idx) {
  const item = allPayments[idx];
  if (!item || !item.penyewa || !item.penyewa.unit_hunian) return;
  bukaKuitansi({
    pembayaran: item,
    penyewa: item.penyewa,
    unit: item.penyewa.unit_hunian
  });
}

function bukaKuitansi({ pembayaran, penyewa, unit }) {
  const isKost = unit.jenis_hunian === 'Kost';
  const headerBrand = isKost ? 'Kakindi Kost' : 'Kakindi Griya';
  const deskripsi = isKost
    ? `Sewa kamar kost ${unit.nama_cabang}, Unit ${unit.kode_unit} untuk ${pembayaran.durasi_bulan} bulan dari tanggal ${formatTanggalIndo(pembayaran.periode_mulai)} s/d ${formatTanggalIndo(pembayaran.periode_selesai)}`
    : `Pembayaran sewa ${unit.nama_cabang}, Unit ${unit.kode_unit} untuk ${pembayaran.durasi_bulan} bulan dari tanggal ${formatTanggalIndo(pembayaran.periode_mulai)} s/d ${formatTanggalIndo(pembayaran.periode_selesai)}`;

  const fasilitasList = Array.isArray(unit.daftar_fasilitas) ? unit.daftar_fasilitas : [];
  const tabelFasilitasHTML = isKost
    ? `<table class="fasilitas-table"><thead><tr><th>Fasilitas</th><th style="width:110px;text-align:center;">Kondisi</th></tr></thead><tbody>${fasilitasList
        .map((f) => `<tr><td>${f.item}</td><td style="text-align:center;">&#9745;</td></tr>`)
        .join('')}</tbody></table>`
    : `<table class="fasilitas-table"><thead><tr><th style="width:70px;text-align:center;">Unit</th><th>Fasilitas</th><th style="width:110px;text-align:center;">Kondisi</th></tr></thead><tbody>${fasilitasList
        .map((f) => `<tr><td style="text-align:center;">${f.qty || 1}</td><td>${f.item}</td><td style="text-align:center;">&#9745;</td></tr>`)
        .join('')}</tbody></table>`;

  document.getElementById('area-kuitansi').innerHTML = `
    <div class="kuitansi-header">
      <div class="kuitansi-brand">${headerBrand}</div>
      <div class="kuitansi-title-box">
        <h3>KUITANSI PEMBAYARAN</h3>
        <div>${pembayaran.nomor_kuitansi}</div>
      </div>
    </div>
    <table class="kuitansi-meta">
      <tr><td>Tanggal</td><td>: ${formatTanggalIndo(pembayaran.tgl_bayar)}</td></tr>
      <tr><td>Telah diterima dari</td><td>: <strong>${penyewa.nama_lengkap}</strong></td></tr>
      <tr><td>Untuk pembayaran</td><td>: ${deskripsi}</td></tr>
      <tr><td>Nominal</td><td>: <span class="nominal-box">${formatRupiah(pembayaran.nominal)}</span></td></tr>
      <tr><td>Terbilang</td><td>: <em>${pembayaran.terbilang}</em></td></tr>
    </table>
    <div class="kuitansi-note">Note: pembayaran berikutnya dilakukan 5 hari sebelum jatuh tempo</div>
    <div class="tanda-terima-title">TANDA TERIMA UNIT</div>
    <table class="kuitansi-meta">
      <tr><td>Tanggal Mulai</td><td>: ${formatTanggalIndo(pembayaran.periode_mulai)}</td></tr>
      <tr><td>Tanggal Selesai</td><td>: ${formatTanggalIndo(pembayaran.periode_selesai)}</td></tr>
      <tr><td>Nama / Unit</td><td>: ${penyewa.nama_lengkap} / ${unit.kode_unit}</td></tr>
    </table>
    ${tabelFasilitasHTML}
    <div class="ttd-grid">
      <div><div>Penerima</div><div class="ttd-space"></div><strong>${pembayaran.penerima}</strong></div>
      <div><div>Penyewa</div><div class="ttd-space"></div><strong>${penyewa.nama_lengkap}</strong></div>
    </div>
  `;
  document.getElementById('modal-kuitansi').classList.remove('hidden');
}

function tutupModal() {
  document.getElementById('modal-kuitansi').classList.add('hidden');
}

// ==========================================
// 9. HELPER FORMATTER
// ==========================================
function formatRupiah(angka) {
  return 'Rp' + Number(angka).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${bulan[m - 1]} ${y}`;
}

function terbilang(nilai) {
  nilai = Math.floor(Math.abs(nilai));
  const huruf = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (nilai < 12) return huruf[nilai];
  if (nilai < 20) return `${terbilang(nilai - 10)} Belas`;
  if (nilai < 100) return `${terbilang(Math.floor(nilai / 10))} Puluh ${terbilang(nilai % 10)}`.trim();
  if (nilai < 200) return `Seratus ${terbilang(nilai - 100)}`.trim();
  if (nilai < 1000) return `${terbilang(Math.floor(nilai / 100))} Ratus ${terbilang(nilai % 100)}`.trim();
  if (nilai < 2000) return `Seribu ${terbilang(nilai - 1000)}`.trim();
  if (nilai < 1000000) return `${terbilang(Math.floor(nilai / 1000))} Ribu ${terbilang(nilai % 1000)}`.trim();
  if (nilai < 1000000000) return `${terbilang(Math.floor(nilai / 1000000))} Juta ${terbilang(nilai % 1000000)}`.trim();
  return `${terbilang(Math.floor(nilai / 1000000000))} Miliar ${terbilang(nilai % 1000000000)}`.trim();
}
