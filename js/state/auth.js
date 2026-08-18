// =========================================================================
// Authentication & Security State
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: login sekarang memakai Firebase Authentication
// (Email + Password) — metode yang SAMA dengan YN Shop. Kredensial
// hardcode (admin/1234, kasir/8888) DIHAPUS. Tidak ada fallback anonymous.
//
// Setelah login berhasil, role diambil dari dokumen profil YN Shop:
//   artifacts/{appId}/users/{uid}/profile/data  ->  field `role`
//
// CATATAN PERLUASAN ROLE:
// Skema profil YN Shop saat ini hanya mengenal role 'customer' & 'admin'
// (lihat isValidAdminProfile di ynstore-main/js/auth/core.js). Supaya
// kasir bisa login ke POS tanpa mengubah/menimpa struktur YN Shop,
// role 'kasir' diperlakukan sebagai NILAI TAMBAHAN yang sah untuk field
// `role` yang sudah ada (bukan field baru, bukan sistem role terpisah).
// Akun dengan role selain 'admin'/'kasir' (mis. 'customer') DITOLAK
// masuk ke POS. Ini perlu didokumentasikan ke Firestore Security Rules
// (lihat SECURITY_RULES.md) supaya validasi tidak hanya di frontend.
//
// PIN LOCK LAYAR: fitur kunci layar sementara (bukan login utama) tetap
// dipertahankan sesuai instruksi "jangan merusak UI POS". PIN sekarang
// disimpan PER AKUN yang sedang login (field ekstensi `posPin` di
// dokumen profil YN Shop miliknya sendiri, ditulis dengan merge supaya
// TIDAK menimpa field lain seperti nama/role/status), bukan lagi PIN
// global admin/kasir yang dibagi semua orang.
// =========================================================================
function createAuthState() {
    return {
        // Sesi & Status Login
        isLoggedIn: false,
        isLocked: false,
        enteredPin: '',
        pinError: false,
        dbConnected: false,
        authReady: false,

        loginForm: {
            email: '',
            password: ''
        },
        loginError: '',

        // PIN kunci layar milik akun yang sedang login (diisi dari profil
        // Firestore setelah login, fallback '1234' jika belum pernah diatur)
        myLockPin: '1234',
        securityForm: { newPin: '1234' },

        // User Aktif — diisi dari Firebase Auth + profil Firestore YN Shop,
        // BUKAN lagi nilai statis hardcode.
        currentUser: {
            uid: null,
            name: '',
            role: '',      // 'Admin' | 'Kasir' (title-case hanya untuk tampilan)
            email: ''
        },
        userProfile: null,

        _profileUnsub: null,

        // --- LOGIN via Firebase Authentication ---
        async handleLogin() {
            this.loginError = '';
            const email = this.loginForm.email.trim();
            const password = this.loginForm.password;

            if (!email || !password) {
                this.loginError = 'Email dan password wajib diisi.';
                return;
            }
            if (!window.posDb?.auth) {
                this.loginError = 'Koneksi Firebase belum siap. Coba lagi sebentar.';
                return;
            }

            try {
                const user = await window.posDb.login(email, password);
                const profile = await window.posDb.getUserProfile(user.uid);

                if (!profile) {
                    this.loginError = 'Akun ditemukan tetapi profil pengguna belum terdaftar di YN Shop. Hubungi admin.';
                    await window.posDb.logout();
                    return;
                }
                if (profile.status === 'disabled') {
                    this.loginError = 'Akun ini telah dinonaktifkan oleh admin.';
                    await window.posDb.logout();
                    return;
                }
                if (profile.role !== 'admin' && profile.role !== 'kasir') {
                    // Role 'customer' (atau role lain) tidak boleh masuk ke POS.
                    this.loginError = 'Akun ini tidak memiliki akses ke sistem kasir.';
                    await window.posDb.logout();
                    return;
                }

                // Login berhasil — sisanya (set currentUser, subscribe, dsb)
                // ditangani terpusat oleh listener onAuthStateChanged di init()
                // supaya tidak ada logika ganda antara login manual & refresh sesi.
                this.showToast(`Selamat datang, ${profile.nama || profile.email}!`, 'success');
            } catch (err) {
                this.loginError = this.translateAuthError(err);
            }
        },

        translateAuthError(err) {
            switch (err.code) {
                case 'auth/user-not-found':
                case 'auth/invalid-credential':
                    return 'Email atau password salah, atau akun belum terdaftar.';
                case 'auth/wrong-password':
                    return 'Password yang Anda masukkan salah.';
                case 'auth/invalid-email':
                    return 'Format email tidak valid.';
                case 'auth/user-disabled':
                    return 'Akun ini telah dinonaktifkan oleh admin.';
                case 'auth/too-many-requests':
                    return 'Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.';
                case 'auth/network-request-failed':
                    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
                default:
                    return 'Login gagal. Silakan coba lagi.';
            }
        },

        // --- Dipanggil oleh listener onAuthStateChanged (lihat js/app.js) ---
        applyLoggedInProfile(user, profile) {
            this.currentUser = {
                uid: user.uid,
                name: profile.nama || profile.email || 'Pengguna',
                role: profile.role === 'admin' ? 'Admin' : 'Kasir',
                email: profile.email || user.email || ''
            };
            this.userProfile = profile;
            this.myLockPin = profile.posPin || '1234';
            this.securityForm.newPin = this.myLockPin;
            this.isLoggedIn = true;
        },

        applyLoggedOut() {
            this.isLoggedIn = false;
            this.isLocked = false;
            this.currentUser = { uid: null, name: '', role: '', email: '' };
            this.userProfile = null;
            this.loginForm = { email: '', password: '' };
            this.cart = [];
            this.currentTab = 'dashboard';
            if (this._profileUnsub) { this._profileUnsub(); this._profileUnsub = null; }
        },

        async logout() {
            try {
                await window.posDb.logout();
                this.showToast('Anda telah keluar.', 'success');
            } catch (e) {
                this.showToast('Gagal logout.', 'error');
            }
        },

        // --- KUNCI LAYAR SEMENTARA (bukan login utama) ---
        handlePinInput(val) {
            this.pinError = false;
            if (val === 'C') this.enteredPin = '';
            else if (val === '←') this.enteredPin = this.enteredPin.slice(0, -1);
            else if (this.enteredPin.length < 4) this.enteredPin += val;

            if (this.enteredPin.length === 4) {
                if (this.enteredPin === this.myLockPin) {
                    this.isLocked = false;
                    this.enteredPin = '';
                } else {
                    this.pinError = true;
                    this.enteredPin = '';
                }
            }
        },

        // --- Ganti PIN kunci layar milik akun sendiri (merge, tidak menimpa profil YN Shop) ---
        async updateMyLockPin() {
            const pin = String(this.securityForm.newPin || '').trim();
            if (!/^\d{4}$/.test(pin)) {
                this.showToast('PIN harus terdiri dari 4 digit angka.', 'error');
                return;
            }
            this.myLockPin = pin;
            if (window.posDb?.db && this.currentUser.uid) {
                await window.posDb.updateOwnProfileField(this.currentUser.uid, { posPin: pin });
            }
            this.showToast('PIN kunci layar berhasil diperbarui!', 'success');
        }
    };
}
