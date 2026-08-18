// =========================================================================
// Authentication & Security State
// Berisi state & logika login, kunci layar (PIN), dan pengelolaan PIN
// keamanan Admin/Kasir. Kredensial default TIDAK diubah dari aplikasi asli
// (username admin/owner/kasir, PIN default dari localStorage atau 1234/8888).
// =========================================================================
function createAuthState() {
    return {
        // Sesi & Status Login (Default Kosong)
        isLoggedIn: false,
        isLocked: false,
        enteredPin: '',
        pinError: false,
        dbConnected: false,
        loginForm: {
            username: '',
            pin: ''
        },
        loginError: '',

        // PIN Keamanan Kustom (Tersimpan di Storage Lokal & Cloud)
        securityPins: {
            adminPin: localStorage.getItem('ynshop_admin_pin') || '1234',
            kasirPin: localStorage.getItem('ynshop_kasir_pin') || '8888'
        },

        securityForm: {
            adminPin: '1234',
            kasirPin: '8888'
        },

        // User Aktif
        currentUser: {
            name: 'Admin',
            role: 'Admin'
        },

        // Login Validasi Aman
        handleLogin() {
            this.loginError = '';
            const username = this.loginForm.username.trim().toLowerCase();
            const pin = this.loginForm.pin.trim();

            if ((username === 'admin' || username === 'owner') && pin === this.securityPins.adminPin) {
                this.currentUser = { name: username.toUpperCase(), role: 'Admin' };
                this.isLoggedIn = true;
                this.showToast('Selamat datang Admin!', 'success');
            } else if (username === 'kasir' && pin === this.securityPins.kasirPin) {
                this.currentUser = { name: 'Kasir Toko', role: 'Kasir' };
                this.isLoggedIn = true;
                this.showToast('Selamat bekerja Kasir!', 'success');
            } else {
                this.loginError = 'Username atau PIN salah! Silakan periksa kembali.';
            }
        },

        logout() {
            this.isLoggedIn = false;
            this.isLocked = false;
            this.loginForm = { username: '', pin: '' };
            this.loginError = '';
            this.cart = [];
            this.currentTab = 'dashboard';
        },

        handlePinInput(val) {
            this.pinError = false;
            if (val === 'C') this.enteredPin = '';
            else if (val === '←') this.enteredPin = this.enteredPin.slice(0, -1);
            else if (this.enteredPin.length < 4) this.enteredPin += val;

            if (this.enteredPin.length === 4) {
                if (this.enteredPin === this.securityPins.adminPin || this.enteredPin === this.securityPins.kasirPin) {
                    this.isLocked = false;
                    this.enteredPin = '';
                } else {
                    this.pinError = true;
                    this.enteredPin = '';
                }
            }
        },

        async updateSecurityPins() {
            this.securityPins = { ...this.securityForm };
            localStorage.setItem('ynshop_admin_pin', this.securityPins.adminPin);
            localStorage.setItem('ynshop_kasir_pin', this.securityPins.kasirPin);

            if (window.posDb?.db) {
                await window.posDb.saveDoc('storeSettings', 'main', { pins: this.securityPins });
            }
            this.showToast('PIN Keamanan berhasil diperbarui!', 'success');
        }
    };
}
