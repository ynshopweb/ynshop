// =========================================================================
// Products (Master Produk) State
// Berisi state & logika CRUD produk, pencarian, filter kategori, serta
// data produk awal yang sudah ada di index.html asli (bukan data baru).
// =========================================================================
function createProductsState() {
    return {
        searchQuery: '',
        selectedCategory: 'all',
        categories: ['makanan', 'minuman', 'snack', 'kebutuhan pokok'],

        productModalOpen: false,
        productForm: { id: null, code: '', name: '', category: 'makanan', buyPrice: 0, sellPrice: 0, stock: 0, minStock: 5, unit: 'Pcs' },

        // Data Master Produk (data awal, sama seperti index.html asli)
        products: [
            { id: '1', code: '8991001', name: 'Minyak Goreng 1L', category: 'kebutuhan pokok', buyPrice: 14000, sellPrice: 17500, stock: 24, minStock: 5, unit: 'Pouch' },
            { id: '2', code: '8991002', name: 'Beras Premium 5kg', category: 'kebutuhan pokok', buyPrice: 62000, sellPrice: 72000, stock: 3, minStock: 5, unit: 'Sak' },
            { id: '3', code: '8991003', name: 'Kopi Kapal Api 165g', category: 'minuman', buyPrice: 11000, sellPrice: 13500, stock: 40, minStock: 10, unit: 'Bks' },
            { id: '4', code: '8991004', name: 'Indomie Goreng Original', category: 'makanan', buyPrice: 2800, sellPrice: 3500, stock: 120, minStock: 20, unit: 'Pcs' }
        ],

        get filteredProducts() {
            return this.products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || String(p.code).includes(this.searchQuery);
                const matchesCategory = this.selectedCategory === 'all' || p.category === this.selectedCategory;
                return matchesSearch && matchesCategory;
            });
        },

        get lowStockCount() {
            return this.products.filter(p => p.stock <= p.minStock).length;
        },

        openProductModal() {
            this.productForm = { id: null, code: '', name: '', category: 'makanan', buyPrice: 0, sellPrice: 0, stock: 0, minStock: 5, unit: 'Pcs' };
            this.productModalOpen = true;
        },

        editProduct(p) {
            this.productForm = { ...p };
            this.productModalOpen = true;
        },

        async saveProduct() {
            const id = this.productForm.id || String(Date.now());
            const productData = { ...this.productForm, id };

            if (window.posDb?.db) {
                await window.posDb.saveDoc('products', id, productData);
            } else {
                const idx = this.products.findIndex(p => p.id === id);
                if (idx >= 0) this.products[idx] = productData;
                else this.products.push(productData);
            }

            this.productModalOpen = false;
            this.showToast('Data produk berhasil disimpan', 'success');
        },

        async deleteProduct(id) {
            if (window.posDb?.db) {
                await window.posDb.deleteDoc('products', id);
            } else {
                this.products = this.products.filter(p => p.id !== id);
            }
            this.showToast('Produk dihapus', 'info');
        }
    };
}
