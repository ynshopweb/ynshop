// =========================================================================
// Transactions & Payment State
// Berisi state & logika modal pembayaran, penyelesaian transaksi
// (checkout), struk/cetak, riwayat penjualan (salesHistory), dan export
// laporan. Identik dengan bagian terkait pada index.html asli.
// =========================================================================
function createTransactionsState() {
    return {
        paymentModalOpen: false,
        payMethod: 'tunai',
        cashGiven: 0,

        receiptModalOpen: false,
        lastTransaction: null,

        salesHistory: [],

        get todaySalesTotal() {
            return this.salesHistory.reduce((sum, s) => sum + (s.total || 0), 0);
        },

        openPaymentModal() {
            this.cashGiven = this.cartGrandTotal;
            this.paymentModalOpen = true;
        },

        async completeTransaction() {
            if (this.cart.length === 0) return;

            const invNo = 'INV-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);
            const txId = String(Date.now());

            for (const item of this.cart) {
                const p = this.products.find(prod => prod.id === item.id);
                if (p) {
                    p.stock = Math.max(0, p.stock - item.qty);
                    if (window.posDb?.db) {
                        await window.posDb.saveDoc('products', p.id, p);
                        const logId = String(Date.now() + Math.random());
                        await window.posDb.saveDoc('stockLogs', logId, {
                            id: logId,
                            date: new Date().toLocaleString('id-ID'),
                            productName: p.name,
                            type: 'OUT',
                            qty: item.qty,
                            note: 'Penjualan ' + invNo
                        });
                    }
                }
            }

            const record = {
                id: txId,
                invoiceNo: invNo,
                date: new Date().toLocaleString('id-ID'),
                cashier: this.currentUser.name,
                paymentMethod: this.payMethod,
                subtotal: this.cartSubtotal,
                discount: this.discount || 0,
                total: this.cartGrandTotal,
                cashGiven: this.payMethod === 'tunai' ? this.cashGiven : this.cartGrandTotal,
                change: this.payMethod === 'tunai' ? Math.max(0, this.cashGiven - this.cartGrandTotal) : 0,
                items: JSON.parse(JSON.stringify(this.cart))
            };

            if (window.posDb?.db) {
                await window.posDb.saveDoc('salesHistory', txId, record);
            } else {
                this.salesHistory.unshift(record);
            }

            this.lastTransaction = record;
            this.paymentModalOpen = false;
            this.clearCart();
            this.receiptModalOpen = true;
        },

        triggerPrint() {
            window.print();
        },

        reprintReceipt(sale) {
            this.lastTransaction = sale;
            this.receiptModalOpen = true;
        },

        exportReport() {
            this.showToast('Data laporan berhasil di-export!', 'success');
        }
    };
}
