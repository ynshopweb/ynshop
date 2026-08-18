// =========================================================================
// Cart (Keranjang Belanja) State
// Berisi state & logika keranjang belanja di halaman Kasir/POS: tambah,
// ubah qty, hapus item, hitung subtotal/total, dan pindai barcode.
// =========================================================================
function createCartState() {
    return {
        cart: [],
        discount: 0,
        taxEnabled: false,

        get cartSubtotal() {
            return this.cart.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
        },

        get cartGrandTotal() {
            let total = this.cartSubtotal - (this.discount || 0);
            if (this.taxEnabled) total += total * 0.11;
            return Math.max(0, total);
        },

        addToCart(product) {
            if (product.stock <= 0) {
                this.showToast('Stok produk telah habis!', 'error');
                return;
            }
            const existing = this.cart.find(i => i.id === product.id);
            if (existing) {
                if (existing.qty < product.stock) existing.qty++;
                else this.showToast('Jumlah melebihi ketersediaan stok!', 'warning');
            } else {
                this.cart.push({ ...product, qty: 1 });
            }
        },

        updateQty(index, delta) {
            const item = this.cart[index];
            const product = this.products.find(p => p.id === item.id);
            if (item.qty + delta > product.stock) {
                this.showToast('Stok tidak mencukupi!', 'warning');
                return;
            }
            item.qty += delta;
            if (item.qty <= 0) this.removeFromCart(index);
        },

        removeFromCart(index) {
            this.cart.splice(index, 1);
        },

        clearCart() {
            this.cart = [];
            this.discount = 0;
        },

        processBarcodeScan() {
            const match = this.products.find(p => String(p.code) === this.searchQuery || p.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
            if (match) {
                this.addToCart(match);
                this.searchQuery = '';
            } else {
                this.showToast('Produk tidak ditemukan!', 'error');
            }
        }
    };
}
