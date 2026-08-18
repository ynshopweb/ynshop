// =========================================================================
// App Entry Point
// Menggabungkan seluruh modul state (js/state/*.js) menjadi satu objek
// Alpine.data('posApp', ...), lalu menjalankan init() yang sama persis
// dengan index.html asli (koneksi Firebase, render chart, load PIN form).
//
// PENTING: penggabungan menggunakan Object.getOwnPropertyDescriptors +
// Object.defineProperties (bukan spread {...obj} biasa). Ini wajib agar
// getter/computed property (mis. filteredProducts, cartGrandTotal,
// todaySalesTotal) tetap reaktif, karena spread biasa akan langsung
// mengeksekusi getter dan mengubahnya menjadi nilai statis (bug).
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
            async init() {
                this.securityForm.adminPin = this.securityPins.adminPin;
                this.securityForm.kasirPin = this.securityPins.kasirPin;

                this.$nextTick(() => this.renderChart());

                if (window.posDb) {
                    const uid = await window.posDb.initAuth();
                    if (uid) {
                        this.dbConnected = true;

                        window.posDb.subscribeCollection('products', (data) => {
                            if (data && data.length > 0) this.products = data;
                            else this.products.forEach(p => window.posDb.saveDoc('products', p.id, p));
                        });

                        window.posDb.subscribeCollection('stockLogs', (data) => {
                            if (data && data.length > 0) this.stockLogs = data.sort((a,b) => (b.id > a.id ? 1 : -1));
                        });

                        window.posDb.subscribeCollection('salesHistory', (data) => {
                            if (data && data.length > 0) this.salesHistory = data.sort((a,b) => (b.id > a.id ? 1 : -1));
                        });

                        window.posDb.subscribeCollection('storeSettings', (data) => {
                            if (data && data.length > 0) {
                                const saved = data[0];
                                if (saved.store) this.store = { ...this.store, ...saved.store };
                                if (saved.pins) {
                                    this.securityPins = saved.pins;
                                    this.securityForm = { ...saved.pins };
                                }
                            }
                        });
                    }
                }
            }
        }
    ));
});
