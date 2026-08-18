// =========================================================================
// Store Settings State
// -------------------------------------------------------------------------
// Pengaturan informasi toko (nama, alamat, telepon, ukuran kertas printer)
// adalah ekstensi POS yang tidak ada di skema YN Shop — disimpan di
// artifacts/{appId}/posSettings/store (satu project Firebase yang sama,
// tidak memengaruhi data YN Shop).
//
// PIN admin/kasir GLOBAL sudah dihapus (lihat js/state/auth.js) — setiap
// akun sekarang punya PIN kunci layarnya sendiri, diatur lewat
// updateMyLockPin() di halaman Pengaturan.
// =========================================================================
function createSettingsState() {
    return {
        store: {
            name: 'YN SHOP POS',
            address: 'Jl. Utama No. 1, Indonesia',
            phone: '0812-3456-7890',
            paperSize: '58mm'
        },

        _subscribeStoreSettings() {
            if (!window.posDb?.db) return;
            window.posDb.subscribeStoreSettings((data) => {
                if (data) this.store = { ...this.store, ...data };
            });
        },

        async saveStoreSettings() {
            try {
                await window.posDb.saveStoreSettings({ ...this.store });
                this.showToast('Pengaturan Toko disimpan!', 'success');
            } catch (err) {
                this.showToast('Gagal menyimpan pengaturan toko: ' + err.message, 'error');
            }
        }
    };
}
