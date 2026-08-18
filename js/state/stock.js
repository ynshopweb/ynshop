// =========================================================================
// Stock Management State
// Berisi state & logika penyesuaian stok (masuk/keluar) beserta riwayat
// (stockLogs). Data awal stockLogs sama seperti index.html asli.
// =========================================================================
function createStockState() {
    return {
        stockModalOpen: false,
        stockForm: { productId: '', type: 'IN', qty: 1, note: '' },

        // Riwayat Stok (data awal, sama seperti index.html asli)
        stockLogs: [
            { id: '1', date: '2026-07-28 09:00', productName: 'Minyak Goreng 1L', type: 'IN', qty: 20, note: 'Stok Awal' }
        ],

        openStockAdjustModal() {
            this.stockForm = { productId: '', type: 'IN', qty: 1, note: '' };
            this.stockModalOpen = true;
        },

        async saveStockAdjust() {
            const product = this.products.find(p => p.id === this.stockForm.productId);
            if (!product) return;

            const change = this.stockForm.type === 'IN' ? this.stockForm.qty : -this.stockForm.qty;
            const newStock = Math.max(0, product.stock + change);

            product.stock = newStock;
            if (window.posDb?.db) {
                await window.posDb.saveDoc('products', product.id, product);

                const logId = String(Date.now());
                await window.posDb.saveDoc('stockLogs', logId, {
                    id: logId,
                    date: new Date().toLocaleString('id-ID'),
                    productName: product.name,
                    type: this.stockForm.type,
                    qty: this.stockForm.qty,
                    note: this.stockForm.note || 'Penyesuaian Manual'
                });
            }

            this.stockModalOpen = false;
            this.showToast('Penyesuaian stok tersimpan', 'success');
        }
    };
}
