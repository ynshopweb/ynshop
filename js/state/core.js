// =========================================================================
// Core / UI State
// Berisi state umum yang dipakai di seluruh aplikasi: navigasi tab,
// dark mode, notifikasi toast, judul halaman, tanggal, dan formatter Rupiah.
// Logika di file ini identik dengan bagian terkait pada index.html asli.
// =========================================================================
function createCoreState() {
    return {
        // Navigasi & Tampilan Umum
        currentTab: 'dashboard',
        darkMode: false,

        // Notifikasi Toast
        toast: { show: false, message: '', type: 'info' },

        showToast(msg, type = 'info') {
            this.toast = { show: true, message: msg, type };
            setTimeout(() => { this.toast.show = false; }, 3200);
        },

        getTabTitle() {
            const titles = {
                dashboard: 'Dashboard Utama',
                pos: 'Kasir & Mesin Kasir',
                products: 'Master Data Produk',
                stock: 'Manajemen Stok Barang',
                reports: 'Laporan Penjualan',
                settings: 'Pengaturan & Keamanan'
            };
            return titles[this.currentTab] || 'YN SHOP POS';
        },

        get currentDate() {
            return new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        },

        formatRupiah(amount) {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
        }
    };
}
