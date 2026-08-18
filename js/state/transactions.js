// =========================================================================
// Transactions & Payment State
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: transaksi kasir SEKARANG ditulis ke koleksi
// `orders` YANG SAMA dengan YN Shop (artifacts/{appId}/orders) — BUKAN
// lagi ke `salesHistory` terpisah. Struktur field mengikuti dokumen order
// YN Shop (lihat ynstore-main/js/checkout.js): orderId, items, totalAmount,
// status, createdAt, ditambah field pembeda sumber & kasir:
//   source: "pos", cashierId, cashierName, paymentMethod, paidAmount, change
//
// Pengurangan stok dilakukan dalam SATU Firestore transaction bersamaan
// dengan pembuatan dokumen order (all-or-nothing), meniru persis pola
// runTransaction di checkout.js YN Shop, supaya:
//   - stok divalidasi ulang dari data TERBARU (bukan cache lokal)
//   - aman jika pembeli online checkout produk yang sama di saat bersamaan
//   - stok tidak pernah menjadi negatif; jika stok kurang, transaksi ditolak
//
// `salesHistory` di UI (tabel Laporan) TIDAK dihapus — sekarang menjadi
// VIEW yang dipetakan dari `orders` (difilter source == 'pos'), bukan lagi
// tujuan tulis terpisah. Nama field yang dipakai template index.html
// (invoiceNo, date, cashier, paymentMethod, total) tetap dipertahankan
// lewat mapping supaya UI tidak perlu diubah.
// =========================================================================
function createTransactionsState() {
    return {
        paymentModalOpen: false,
        payMethod: 'tunai',
        cashGiven: 0,

        receiptModalOpen: false,
        lastTransaction: null,

        // Data mentah order dari Firestore (semua source: online + pos)
        orders: [],

        _subscribeOrders() {
            if (!window.posDb?.db) return;
            window.posDb.subscribeOrders((data) => {
                this.orders = (data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                // Grafik dashboard dihitung dari this.orders (lihat dashboard.js) —
                // render ulang tiap kali data order berubah supaya selalu real-time.
                if (typeof this.renderChart === 'function') this.renderChart();
            });
        },

        // --- VIEW: transaksi kasir saja, dipetakan ke bentuk yang dipakai UI lama ---
        get salesHistory() {
            return this.orders
                .filter(o => o.source === 'pos')
                .map(o => ({
                    id: o.id,
                    invoiceNo: o.orderId,
                    date: o.createdAt ? new Date(o.createdAt).toLocaleString('id-ID') : '-',
                    cashier: o.cashierName || '-',
                    paymentMethod: o.paymentMethod || '-',
                    total: o.totalAmount || 0,
                    items: o.items || [],
                    paidAmount: o.paidAmount || 0,
                    change: o.change || 0,
                    raw: o
                }));
        },

        // --- Penjualan HARI INI, dipisah per sumber (dasar Laporan Gabungan) ---
        get todayOrders() {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            return this.orders.filter(o => (o.createdAt || 0) >= startOfDay);
        },
        get todaySalesTotal() {
            // Kartu "Penjualan Hari Ini" di Dashboard POS = transaksi kasir hari ini.
            return this.todayOrders
                .filter(o => o.source === 'pos')
                .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        },
        get todayOnlineSalesTotal() {
            return this.todayOrders
                .filter(o => o.source === 'online')
                .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        },

        openPaymentModal() {
            this.cashGiven = this.cartGrandTotal;
            this.paymentModalOpen = true;
        },

        // --- TRANSAKSI ATOMIK: VALIDASI STOK + KURANGI STOK + BUAT ORDER ---
        async completeTransaction() {
            if (this.cart.length === 0) return;

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const orderId = `POS-${dateStr}-${randomDigits}`;
            const cartSnapshot = JSON.parse(JSON.stringify(this.cart));
            const paymentMethod = this.payMethod;
            const paidAmount = paymentMethod === 'tunai' ? this.cashGiven : this.cartGrandTotal;
            const discount = this.discount || 0;
            const cashierId = this.currentUser.uid;
            const cashierName = this.currentUser.name;

            let orderData = null;

            try {
                await window.posDb.runStockTransaction(async (transaction) => {
                    const productRefs = cartSnapshot.map(item => window.posDb.productDocRef(item.id));

                    // 1. BACA seluruh dokumen produk terbaru (wajib sebelum write apa pun)
                    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

                    // 2. VALIDASI stok terbaru untuk tiap item keranjang
                    const insufficient = [];
                    productSnaps.forEach((snap, idx) => {
                        const cartItem = cartSnapshot[idx];
                        if (!snap.exists()) {
                            insufficient.push(`${cartItem.name} (produk tidak ditemukan)`);
                            return;
                        }
                        const data = snap.data();
                        const currentStock = (typeof data.stock === 'number') ? data.stock : 0;
                        if (currentStock < cartItem.qty) {
                            insufficient.push(`${cartItem.name} (sisa stok: ${currentStock})`);
                        }
                    });
                    if (insufficient.length > 0) {
                        throw new Error(`Stok tidak mencukupi untuk: ${insufficient.join(', ')}.`);
                    }

                    // 3. Harga final diambil dari data produk TERBARU (field `price` YN Shop)
                    const finalItems = productSnaps.map((snap, idx) => {
                        const cartItem = cartSnapshot[idx];
                        const data = snap.data();
                        const unitPrice = (typeof data.price === 'number') ? data.price : cartItem.sellPrice;
                        return { id: cartItem.id, name: cartItem.name, qty: cartItem.qty, price: unitPrice };
                    });
                    const subtotal = finalItems.reduce((sum, it) => sum + (it.price * it.qty), 0);
                    const totalAmount = Math.max(0, subtotal - discount);

                    // 4. TULIS: kurangi stok tiap produk + buat dokumen order
                    productSnaps.forEach((snap, idx) => {
                        const cartItem = cartSnapshot[idx];
                        const data = snap.data();
                        const newStock = Math.max(0, (data.stock || 0) - cartItem.qty);
                        transaction.update(productRefs[idx], { stock: newStock });
                    });

                    orderData = {
                        orderId,
                        source: 'pos',
                        cashierId,
                        cashierName,
                        items: finalItems,
                        subtotal,
                        discount,
                        tax: 0,
                        totalAmount,
                        paymentMethod,
                        paidAmount,
                        change: paymentMethod === 'tunai' ? Math.max(0, paidAmount - totalAmount) : 0,
                        status: 'Selesai',
                        createdAt: Date.now()
                    };

                    transaction.set(window.posDb.orderDocRef(orderId), orderData);
                });

                this.lastTransaction = {
                    id: orderId,
                    invoiceNo: orderData.orderId,
                    date: new Date(orderData.createdAt).toLocaleString('id-ID'),
                    cashier: cashierName,
                    paymentMethod: orderData.paymentMethod,
                    subtotal: orderData.subtotal,
                    discount: orderData.discount,
                    total: orderData.totalAmount,
                    cashGiven: orderData.paidAmount,
                    change: orderData.change,
                    // Struk (index.html) memakai nama field `sellPrice` per item —
                    // dokumen order Firestore menyimpan `price` (field asli YN Shop),
                    // jadi dipetakan di sini, bukan di template.
                    items: orderData.items.map(it => ({ ...it, sellPrice: it.price }))
                };

                this.paymentModalOpen = false;
                this.clearCart();
                this.receiptModalOpen = true;
            } catch (err) {
                this.showToast('Transaksi gagal: ' + err.message, 'error');
            }
        },

        triggerPrint() {
            window.print();
        },

        reprintReceipt(sale) {
            this.lastTransaction = {
                id: sale.id,
                invoiceNo: sale.invoiceNo,
                date: sale.date,
                cashier: sale.cashier,
                paymentMethod: sale.paymentMethod,
                subtotal: sale.raw?.subtotal || sale.total,
                discount: sale.raw?.discount || 0,
                total: sale.total,
                items: (sale.items || []).map(it => ({ ...it, sellPrice: it.price })),
                cashGiven: sale.paidAmount,
                change: sale.change
            };
            this.receiptModalOpen = true;
        },

        exportReport() {
            this.showToast('Data laporan berhasil di-export!', 'success');
        }
    };
}
