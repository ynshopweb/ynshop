# YN SHOP POS — Struktur Project (Hasil Refactor)

Project ini adalah hasil pemisahan dari `index.html` tunggal menjadi struktur
modular, **tanpa mengubah tampilan, fitur, alur kerja, library, maupun data**
yang sudah ada. Refactor ini murni reorganisasi kode.

## Cara menjalankan

Karena `js/firebase-service.js` dimuat sebagai ES Module (`type="module"`),
file harus diakses lewat web server lokal (bukan dibuka langsung via
`file://`), sama seperti kebutuhan aplikasi aslinya. Contoh:

```bash
# dari dalam folder posynshop/
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

## Struktur folder

```
posynshop/
├── index.html                  # Markup halaman (identik dengan versi asli)
├── css/
│   └── style.css                # Style kustom ([x-cloak], print struk)
├── js/
│   ├── tailwind-config.js       # Konfigurasi tema Tailwind (warna primary)
│   ├── firebase-service.js      # Koneksi Firebase & helper window.posDb
│   ├── app.js                   # Registrasi Alpine.data('posApp') + init()
│   └── state/
│       ├── core.js              # Navigasi tab, toast, format Rupiah, tanggal
│       ├── auth.js              # Login, kunci layar (PIN), keamanan PIN
│       ├── settings.js          # Pengaturan informasi toko
│       ├── products.js          # Master produk (CRUD, pencarian, filter)
│       ├── stock.js             # Penyesuaian & riwayat stok
│       ├── cart.js              # Keranjang belanja kasir
│       ├── transactions.js      # Pembayaran, checkout, struk, riwayat jual
│       └── dashboard.js         # Grafik penjualan mingguan (Chart.js)
└── README.md
```

## Prinsip penggabungan modul (`js/app.js`)

Setiap file di `js/state/` mengekspos sebuah fungsi factory global
(`createCoreState()`, `createAuthState()`, dst.) yang mengembalikan potongan
state Alpine.js. `js/app.js` menggabungkan semuanya menjadi satu objek lewat
`Object.defineProperties(target, Object.getOwnPropertyDescriptors(mixin))`
— **bukan** `{...spread}` biasa — supaya *computed property* (getter) seperti
`filteredProducts`, `cartGrandTotal`, `todaySalesTotal`, dan `lowStockCount`
tetap reaktif, bukan berubah menjadi nilai statis.

## Yang TIDAK berubah dari versi asli

- Tampilan/desain UI (class Tailwind, ikon, struktur HTML) — identik 1:1.
- Semua fitur & alur kerja POS (login, kasir, master produk, stok, laporan,
  pengaturan, cetak struk).
- Library yang dipakai: Tailwind CDN, FontAwesome, Chart.js, Alpine.js,
  Firebase (modular SDK v11.6.1).
- Data contoh awal (produk, riwayat stok) — tidak ada data dummy baru.
- Sistem login: tetap berbasis username + PIN yang dicek terhadap
  `securityPins` (default `1234` / `8888`, bisa diubah lewat menu
  Pengaturan → Keamanan Login & PIN Akses). Tidak ada sistem login palsu
  baru — ini kredensial yang memang sudah ada di kode asli.

## Rekomendasi lanjutan (opsional, tidak dilakukan dalam refactor ini)

Karena tidak boleh mengganti struktur data, memindahkan login/PIN ke sisi
server (bukan disimpan sebagai plaintext di kode/localStorage) adalah hal
yang sebaiknya dipertimbangkan sebelum aplikasi ini dipakai untuk data nyata,
tapi ini di luar cakupan refactor pemisahan file yang diminta.
