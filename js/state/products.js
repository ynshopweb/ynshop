// =========================================================================
// Products (Master Produk) State
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: koleksi produk SEKARANG SATU dengan YN Shop
// (artifacts/{appId}/products) — bukan lagi koleksi terpisah punya POS.
//
// ADAPTER FIELD (dijelaskan di laporan analisis sebelumnya):
//   YN Shop `price`  <->  POS `sellPrice`
// Mapping dilakukan di layer JS ini saja — UI (index.html) TIDAK diubah
// dan tetap memakai nama `sellPrice` seperti sebelumnya.
//
// Field ekstensi milik POS (code/barcode, buyPrice, minStock, unit) TIDAK
// ada di skema asli YN Shop. Field ini disimpan BERDAMPINGAN di dokumen
// produk yang sama via update PARSIAL (merge) — tidak pernah menimpa
// field YN Shop seperti image/brand/promo/description/category yang
// tidak dikelola form POS.
//
// TIDAK ADA LAGI data dummy & auto-seed. Jika koleksi kosong / gagal
// dibaca, tampilkan pesan sesuai kondisinya (lihat products di index.html
// yang menampilkan state kosong berdasarkan array `products`).
// =========================================================================
function createProductsState() {
    return {
        searchQuery: '',
        selectedCategory: 'all',

        productModalOpen: false,
        productForm: { id: null, code: '', name: '', category: '', buyPrice: 0, sellPrice: 0, stock: 0, minStock: 5, unit: 'Pcs' },

        // Diisi dari Firestore (artifacts/{appId}/products), TIDAK ADA seed dummy.
        products: [],
        productsLoading: true,
        productsError: null,

        // Kategori dibangun dinamis dari produk YN Shop yang benar-benar ada
        // (bukan daftar hardcode 'makanan'/'minuman' bawaan POS lama).
        get categories() {
            return [...new Set(this.products.map(p => p.category).filter(Boolean))];
        },

        get filteredProducts() {
            return this.products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase())
                    || String(p.code || '').includes(this.searchQuery);
                const matchesCategory = this.selectedCategory === 'all' || p.category === this.selectedCategory;
                return matchesSearch && matchesCategory;
            });
        },

        get lowStockCount() {
            return this.products.filter(p => p.stock <= (p.minStock ?? 5)).length;
        },

        // --- Mapping 1 dokumen Firestore YN Shop -> objek produk sisi POS ---
        // `sellPrice` adalah ALIAS baca dari `price` (dipakai UI POS apa adanya).
        // `price` asli tetap disertakan supaya penulisan balik ke Firestore
        // tidak pernah menebak nama field.
        _mapFromFirestore(doc) {
            return {
                id: doc.id,
                name: doc.name,
                category: doc.category || '-',
                image: doc.image,
                brand: doc.brand,
                stock: (typeof doc.stock === 'number') ? doc.stock : 0,
                price: doc.price,                 // field asli YN Shop
                sellPrice: doc.price,             // alias untuk UI POS (tidak diubah)
                // Field ekstensi POS — mungkin belum ada di produk lama, default aman:
                code: doc.code || '',
                buyPrice: (typeof doc.buyPrice === 'number') ? doc.buyPrice : 0,
                minStock: (typeof doc.minStock === 'number') ? doc.minStock : 5,
                unit: doc.unit || 'Pcs'
            };
        },

        _subscribeProducts() {
            if (!window.posDb?.db) return;
            window.posDb.subscribeProducts((data, err) => {
                if (err) {
                    this.productsError = 'Gagal memuat produk dari database. Periksa koneksi & hak akses.';
                    this.productsLoading = false;
                    return;
                }
                this.productsError = null;
                this.productsLoading = false;
                this.products = (data || []).map(d => this._mapFromFirestore(d));
            });
        },

        openProductModal() {
            this.productForm = { id: null, code: '', name: '', category: this.categories[0] || '', buyPrice: 0, sellPrice: 0, stock: 0, minStock: 5, unit: 'Pcs' };
            this.productModalOpen = true;
        },

        editProduct(p) {
            this.productForm = { ...p };
            this.productModalOpen = true;
        },

        // --- SIMPAN PRODUK ---
        // Update PARSIAL (merge): hanya menulis field yang memang dikelola
        // form POS. Field YN Shop lain (image, brand, promo, description,
        // originalPrice, rating, sales, isBestseller, isNew) TIDAK disentuh
        // sama sekali kalau tidak ada di objek yang dikirim.
        async saveProduct() {
            const f = this.productForm;
            const partial = {
                name: f.name,
                category: f.category,
                price: Number(f.sellPrice) || 0,     // ditulis ke field asli YN Shop
                stock: Math.max(0, Number(f.stock) || 0),
                code: f.code || '',
                buyPrice: Number(f.buyPrice) || 0,
                minStock: Number(f.minStock) || 5,
                unit: f.unit || 'Pcs'
            };

            try {
                if (f.id) {
                    await window.posDb.saveProductMerge(f.id, partial);
                } else {
                    // Produk baru dari POS: tetap disertai field yang dipakai
                    // tampilan katalog YN Shop supaya tidak tampil rusak di web
                    // (nilai default aman, admin YN Shop bisa melengkapi nanti).
                    await window.posDb.addProduct({
                        ...partial,
                        image: '',
                        brand: '-',
                        description: '',
                        originalPrice: partial.price,
                        rating: 0,
                        sales: 0,
                        isBestseller: false,
                        isNew: true,
                        promo: { active: false, type: 'percentage', value: 0, startDate: '', endDate: '' }
                    });
                }
                this.productModalOpen = false;
                this.showToast('Data produk berhasil disimpan', 'success');
            } catch (err) {
                if (err.code === 'permission-denied') {
                    this.showToast('Akses ditolak: akun Anda tidak memiliki izin mengubah produk.', 'error');
                } else {
                    this.showToast('Gagal menyimpan produk: ' + err.message, 'error');
                }
            }
        },

        async deleteProduct(id) {
            try {
                await window.posDb.deleteProduct(id);
                this.showToast('Produk dihapus', 'info');
            } catch (err) {
                if (err.code === 'permission-denied') {
                    this.showToast('Akses ditolak: akun Anda tidak memiliki izin menghapus produk.', 'error');
                } else {
                    this.showToast('Gagal menghapus produk: ' + err.message, 'error');
                }
            }
        }
    };
}
