# Catatan Integrasi YN POS ↔ YN Shop (Tahap 1: Refactor + Read-only Testing)

## Yang sudah dilakukan
- Firebase project POS diganti ke project YN Shop (`ynstore-c602f`, appId
  `ynstore-default-id`) — project `ynshopkasir` tidak dipakai lagi.
- Koleksi `products`, `orders`, `users/{uid}/profile/data` sekarang
  **satu database** dengan YN Shop (`js/firebase-service.js`).
- Login POS: Firebase Authentication Email+Password, tidak ada lagi
  hardcode admin/kasir, **tidak ada fallback anonymous** (`js/state/auth.js`,
  `js/app.js`).
- Field POS (`sellPrice`, `buyPrice`, `code`, `minStock`, `unit`) dipetakan
  ke/​dari field YN Shop (`price`) di layer JS (`js/state/products.js`) —
  UI tidak diubah.
- Update produk dari POS memakai **merge parsial**, tidak pernah menimpa
  `image`, `brand`, `promo`, `description`, dll.
- Transaksi kasir & pengurangan stok memakai **Firestore transaction**
  (`js/state/transactions.js`), sama pola dengan `checkout.js` YN Shop.
- Transaksi kasir ditulis ke `orders` (bukan `salesHistory` terpisah lagi)
  dengan `source: "pos"`, `cashierId`, `cashierName`. Tabel "Laporan
  Penjualan" & kartu Dashboard sekarang membaca `orders` asli — tidak ada
  angka hardcode lagi (termasuk grafik mingguan).
- Data dummy produk & auto-seed **dihapus total**. Kondisi kosong/gagal
  baca menampilkan pesan, bukan data palsu.
- Role admin/kasir divalidasi dari `users/{uid}/profile/data.role`
  (perluasan nilai — lihat catatan di `js/state/auth.js`); tombol
  kelola produk/stok/pengaturan toko disembunyikan untuk role selain
  Admin di frontend — **wajib dikuatkan lewat Security Rules**
  (lihat `SECURITY_RULES_RECOMMENDATION.md`).
- PIN kunci layar sekarang per-akun (field `posPin` di profil masing-masing,
  merge), bukan PIN global admin/kasir yang dibagi semua orang.

## Yang SENGAJA BELUM dilakukan (menunggu approval Anda)
- **Tidak ada migrasi data** dari produk/riwayat POS lama ke `products`
  YN Shop — sesuai instruksi #3, #21, #22.
- **Tidak ada penghapusan** data lama di project `ynshopkasir`.
- Firestore Security Rules **belum di-deploy** — hanya rekomendasi tertulis,
  karena environment ini tidak punya akses jaringan untuk deploy.
- Notifikasi real-time (`notifications` per user) belum dibangun — UI POS
  saat ini memang tidak punya komponen lonceng notifikasi, jadi tidak
  ditambahkan supaya tidak mengubah tampilan; beri tahu saya jika Anda mau
  fitur ini ditambahkan di tahap berikutnya.

## Langkah Anda selanjutnya (sebelum lanjut ke migrasi)
1. Jalankan TEST 1–9 sesuai instruksi #21 (login, baca produk, ubah
   produk dari YN Shop → cek POS, transaksi POS → cek stok & laporan,
   ganti akun → cek nama/role sesuai).
2. Pastikan setiap staff kasir/admin YN Shop yang perlu akses POS punya
   dokumen profil dengan `role: "admin"` atau `role: "kasir"` (field
   `role` baru bernilai `"kasir"` ini perlu ditambahkan manual dulu ke
   akun yang relevan — silakan konfirmasi siapa saja).
3. Review & deploy `SECURITY_RULES_RECOMMENDATION.md`.
4. Setelah semua lolos, saya siapkan **laporan migrasi** (jumlah produk
   POS lama vs YN Shop, duplikat kode/SKU) dari data live sebelum migrasi
   apa pun dijalankan.
