// =========================================================================
// Stock Management State
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: field `stock` yang diubah di sini adalah field
// `stock` YANG SAMA dipakai YN Shop (bukan stok terpisah). Penyesuaian
// memakai Firestore transaction (runTransaction) supaya aman jika ada
// pembeli online yang checkout bersamaan pada produk yang sama — stok
// dibaca ulang di dalam transaksi, bukan dari cache state.products yang
// mungkin sudah usang.
//
// Riwayat stok (stockLogs) adalah koleksi EKSTENSI milik POS (tidak ada
// di skema YN Shop) — disimpan di artifacts/{appId}/stockLogs supaya
// tetap dalam satu project Firebase yang sama, tanpa memengaruhi data
// YN Shop.
// =========================================================================
function createStockState() {
    return {
        stockModalOpen: false,
        stockForm: { productId: '', type: 'IN', qty: 1, note: '' },

        stockLogs: [],

        _subscribeStockLogs() {
            if (!window.posDb?.db) return;
            window.posDb.subscribeStockLogs((data) => {
                this.stockLogs = (data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            });
        },

        openStockAdjustModal() {
            this.stockForm = { productId: '', type: 'IN', qty: 1, note: '' };
            this.stockModalOpen = true;
        },

        async saveStockAdjust() {
            const productId = this.stockForm.productId;
            const type = this.stockForm.type;
            const qty = Math.max(1, Number(this.stockForm.qty) || 1);
            const note = this.stockForm.note || 'Penyesuaian Manual';

            const productRef = window.posDb.productDocRef(productId);
            let productName = '';
            let finalStock = 0;

            try {
                await window.posDb.runStockTransaction(async (transaction) => {
                    const snap = await transaction.get(productRef);
                    if (!snap.exists()) throw new Error('Produk tidak ditemukan di database.');

                    const data = snap.data();
                    productName = data.name;
                    const currentStock = (typeof data.stock === 'number') ? data.stock : 0;
                    const change = type === 'IN' ? qty : -qty;
                    const newStock = currentStock + change;

                    if (newStock < 0) {
                        throw new Error(`Stok tidak mencukupi untuk dikurangi (sisa saat ini: ${currentStock}).`);
                    }

                    finalStock = newStock;
                    transaction.update(productRef, { stock: newStock });
                });

                const now = Date.now();
                await window.posDb.addStockLog({
                    productId,
                    productName,
                    type,
                    qty,
                    note,
                    resultingStock: finalStock,
                    cashierId: this.currentUser.uid,
                    cashierName: this.currentUser.name,
                    date: new Date(now).toLocaleString('id-ID'),
                    createdAt: now
                });

                this.stockModalOpen = false;
                this.showToast('Penyesuaian stok tersimpan', 'success');
            } catch (err) {
                this.showToast('Gagal menyesuaikan stok: ' + err.message, 'error');
            }
        }
    };
}
