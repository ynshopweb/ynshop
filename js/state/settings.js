// =========================================================================
// Store Settings State
// Berisi state & logika pengaturan informasi toko (nama, alamat, telepon,
// ukuran kertas printer thermal). Identik dengan bagian terkait pada
// index.html asli.
// =========================================================================
function createSettingsState() {
    return {
        // Informasi Toko
        store: {
            name: 'YN SHOP POS',
            address: 'Jl. Utama No. 1, Indonesia',
            phone: '0812-3456-7890',
            paperSize: '58mm'
        },

        async saveStoreSettings() {
            if (window.posDb?.db) {
                await window.posDb.saveDoc('storeSettings', 'main', { store: this.store });
            }
            this.showToast('Pengaturan Toko disimpan!', 'success');
        }
    };
}
