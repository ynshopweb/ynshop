# Rekomendasi Firestore Security Rules — Integrasi YN Shop + YN POS

> **Status: REKOMENDASI, belum di-deploy oleh Claude.** File rules asli
> (`firestore.rules`) YN Shop tidak disertakan di dalam zip yang diunggah,
> jadi berkas ini disusun dari nol berdasarkan pola akses yang ditemukan
> di kode YN Shop (`isValidAdminProfile`, path Firestore yang dipakai,
> dsb). **Anda perlu mereview & men-deploy sendiri lewat Firebase Console
> atau Firebase CLI** — Claude tidak memiliki akses jaringan untuk
> mendeploy rules dari sini.

Validasi berikut WAJIB berjalan di server (rules), bukan hanya
disembunyikan di frontend (instruksi #10 & #20).

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function myProfile() {
      return get(/databases/$(database)/documents/artifacts/$(database)/users/$(request.auth.uid)/profile/data).data;
      // Catatan: sesuaikan {appId} literal di path ini dengan nilai
      // sebenarnya (mis. 'ynstore-default-id') karena Security Rules
      // tidak bisa membaca variabel appId dari kode JS.
    }

    function isActiveAdmin() {
      return isSignedIn() && myProfile().role == 'admin' && myProfile().status == 'active';
    }

    function isActiveKasir() {
      return isSignedIn() && myProfile().role == 'kasir' && myProfile().status == 'active';
    }

    function isActiveStaff() {
      return isActiveAdmin() || isActiveKasir();
    }

    match /artifacts/{appId}/products/{productId} {
      allow read: if true; // katalog publik, sama seperti sekarang
      // Tulis produk: admin YN Shop ATAU admin POS. Kasir TIDAK BOLEH
      // mengubah produk (sesuai batasan hak akses instruksi #10).
      allow write: if isActiveAdmin();
    }

    match /artifacts/{appId}/orders/{orderId} {
      allow read: if isSignedIn(); // pemilik order & staff toko
      // Create: customer membuat order miliknya sendiri (source=online),
      // ATAU staff toko membuat order kasir (source=pos).
      allow create: if (isSignedIn() && request.resource.data.userId == request.auth.uid)
                    || isActiveStaff();
      // Update status dsb: hanya admin (verifikasi pembayaran) atau staff toko.
      allow update: if isActiveAdmin() || isActiveStaff();
    }

    match /artifacts/{appId}/users/{uid}/profile/data {
      allow read: if isSignedIn() && (request.auth.uid == uid || isActiveAdmin());
      // User biasa hanya boleh update sebagian field miliknya sendiri
      // (mis. posPin) — TIDAK BOLEH mengubah role/status diri sendiri.
      allow update: if isActiveAdmin()
                    || (request.auth.uid == uid
                        && request.resource.data.role == resource.data.role
                        && request.resource.data.status == resource.data.status);
      allow create: if request.auth.uid == uid;
    }

    match /settings/payment {
      allow read: if true;
      allow write: if isActiveAdmin();
    }

    // --- Ekstensi khusus POS (bukan bagian struktur asli YN Shop) ---
    match /artifacts/{appId}/posSettings/{docId} {
      allow read: if isActiveStaff();
      allow write: if isActiveAdmin();
    }
    match /artifacts/{appId}/stockLogs/{logId} {
      allow read: if isActiveStaff();
      allow create: if isActiveStaff();
      allow update, delete: if isActiveAdmin();
    }
  }
}
```

## Jika POS menerima "Missing or insufficient permissions"

Sesuai instruksi #20, POS tidak akan mencoba workaround anonymous. Jika
Anda menjalankan TEST 1–9 dan menemukan error ini, laporkan ke saya:
1. Path/collection yang ditolak (terlihat di console browser).
2. Operasi yang dilakukan (read/write/update/delete).
3. Role akun yang sedang login saat itu.

Saya akan sesuaikan rekomendasi rules di atas, bukan menambal dari sisi kode POS.
