// =========================================================================
// App Entry Point
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: alur init() sekarang mengikuti pola YN Shop —
// onAuthStateChanged sebagai satu-satunya sumber kebenaran status login,
// TIDAK ADA signInAnonymously, TIDAK ADA auto-login.
//
// Urutan saat app dibuka:
//   1. Tunggu status Firebase Auth (bukan langsung login anonymous).
//   2. Jika ada user login -> ambil profil (users/{uid}/profile/data),
//      validasi role admin/kasir & status active, baru set isLoggedIn.
//   3. Subscribe seluruh data (products, orders, stockLogs, settings)
//      HANYA setelah user tervalidasi.
//   4. Jika tidak ada user -> tampilkan layar login (isLoggedIn = false).
// =========================================================================
function mergeMixins(...mixins) {
    const result = {};
    for (const mixin of mixins) {
        Object.defineProperties(result, Object.getOwnPropertyDescriptors(mixin));
    }
    return result;
}

document.addEventListener('alpine:init', () => {
    Alpine.data('posApp', () => mergeMixins(
        createCoreState(),
        createAuthState(),
        createSettingsState(),
        createProductsState(),
        createStockState(),
        createCartState(),
        createTransactionsState(),
        createDashboardState(),
        {
            _dataSubscribed: false,

            async init() {
                this.$nextTick(() => this.renderChart());

                // --- Tunggu window.posDb siap (BUKAN langsung menyerah) ---
                // js/firebase-service.js dimuat sebagai ES module dan masih
                // harus mengambil beberapa file SDK Firebase dari gstatic.com
                // sebelum window.posDb terbentuk. Alpine bisa saja selesai
                // init() LEBIH DULU daripada proses itu selesai (race
                // condition), jadi di sini kita tunggu (polling ringan)
                // sampai window.posDb benar-benar ada, dengan batas waktu
                // wajar, sebelum menyerah dan menampilkan pesan error.
                const posDbReady = await this._waitForPosDb(10000);

                if (!posDbReady) {
                    this.dbConnected = false;
                    this.loginError = 'Gagal memuat koneksi Firebase. Periksa koneksi internet Anda, lalu muat ulang halaman.';
                    this.authReady = true;
                    return;
                }

                window.posDb.onAuthChange(async (user) => {
                    this.authReady = true;

                    if (!user) {
                        this.dbConnected = false;
                        this.applyLoggedOut();
                        return;
                    }

                    try {
                        const profile = await window.posDb.getUserProfile(user.uid);

                        if (!profile || profile.status === 'disabled' || (profile.role !== 'admin' && profile.role !== 'kasir')) {
                            // Sesi tidak sah untuk akses POS -> paksa logout + beri tahu
                            // alasannya, JANGAN fallback ke anonymous/data dummy apa pun.
                            this.loginError = !profile
                                ? 'Profil pengguna tidak ditemukan di database YN Shop. Hubungi admin.'
                                : profile.status === 'disabled'
                                    ? 'Akun ini telah dinonaktifkan oleh admin.'
                                    : 'Akun ini tidak memiliki akses ke sistem kasir (role bukan admin/kasir).';
                            await window.posDb.logout();
                            return;
                        }

                        this.dbConnected = true;
                        this.applyLoggedInProfile(user, profile);

                        // --- Listener real-time profil sendiri (role/status bisa
                        // berubah kapan saja dari sisi admin YN Shop) ---
                        if (this._profileUnsub) this._profileUnsub();
                        this._profileUnsub = window.posDb.subscribeUserProfile(user.uid, (liveProfile) => {
                            if (!liveProfile || liveProfile.status === 'disabled') {
                                this.showToast('Akun Anda telah dinonaktifkan oleh admin.', 'error');
                                window.posDb.logout();
                                return;
                            }
                            this.applyLoggedInProfile(user, liveProfile);
                        });

                        if (!this._dataSubscribed) {
                            this._dataSubscribed = true;
                            this._subscribeProducts();
                            this._subscribeOrders();
                            this._subscribeStockLogs();
                            this._subscribeStoreSettings();
                        }
                    } catch (err) {
                        console.error('Gagal memuat profil pengguna:', err);
                        this.loginError = 'Gagal memverifikasi akun. Periksa hak akses Firestore.';
                        await window.posDb.logout();
                    }
                });
            },

            // Polling ringan menunggu window.posDb tersedia (lihat catatan di atas init()).
            _waitForPosDb(timeoutMs) {
                return new Promise((resolve) => {
                    if (window.posDb) { resolve(true); return; }
                    const start = Date.now();
                    const interval = setInterval(() => {
                        if (window.posDb) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (Date.now() - start > timeoutMs) {
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 50);
                });
            }
        }
    ));
});
