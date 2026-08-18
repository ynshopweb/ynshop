// =========================================================================
// Firebase Service (ES Module)
// TAHAP INTEGRASI YN SHOP <-> YN POS
// -------------------------------------------------------------------------
// Project Firebase SEKARANG memakai project YN Shop yang sudah ada
// (bukan project POS terpisah lagi). Path Firestore mengikuti persis
// struktur yang dipakai YN Shop (js/config.js, js/products.js,
// js/orders.js, js/auth/core.js di project YN Shop):
//
//   artifacts/{appId}/products/{productId}
//   artifacts/{appId}/orders/{orderId}
//   artifacts/{appId}/users/{uid}/profile/data
//   settings/payment                      (top-level, bukan di bawah artifacts)
//
// TIDAK ADA LAGI:
//   - project ynshopkasir
//   - path artifacts/{appId}/public/data/*
//   - signInAnonymously untuk akses produksi
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    collection,
    onSnapshot,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -------------------------------------------------------------------------
// KONFIGURASI FIREBASE — SAMA PERSIS DENGAN YN SHOP (Project: ynstore-c602f)
// Disalin dari ynstore-main/js/config.js. JANGAN buat project baru,
// JANGAN kembali ke config ynshopkasir.
// -------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyD_Lec5cjzcikNIK0t_JA-oX6ky--UoOGc",
    authDomain: "ynstore-c602f.firebaseapp.com",
    projectId: "ynstore-c602f",
    storageBucket: "ynstore-c602f.firebasestorage.app",
    messagingSenderId: "207239538771",
    appId: "1:207239538771:web:e9ec0fe896b371f5607ea6",
    measurementId: "G-Q844PTQJFG"
};

// appId untuk path Firestore multi-tenant — sama seperti YN Shop.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ynstore-default-id';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// -------------------------------------------------------------------------
// Helper path Firestore (biar tidak menebak-nebak/duplikasi string di modul lain)
// -------------------------------------------------------------------------
const productsCol = () => collection(db, 'artifacts', appId, 'products');
const productDocRef = (id) => doc(db, 'artifacts', appId, 'products', id);
const ordersCol = () => collection(db, 'artifacts', appId, 'orders');
const orderDocRef = (id) => doc(db, 'artifacts', appId, 'orders', id);
const userProfileRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data');
const paymentSettingsRef = () => doc(db, 'settings', 'payment');

// storeSettings & stockLogs BUKAN bagian dari struktur YN Shop yang sudah
// ada. Ini ekstensi khusus POS yang tidak mengganggu/menimpa apa pun milik
// YN Shop — disimpan berdampingan di bawah artifacts/{appId} juga supaya
// tetap satu project & tidak lagi memakai database ynshopkasir.
const storeSettingsRef = () => doc(db, 'artifacts', appId, 'posSettings', 'store');
const stockLogsCol = () => collection(db, 'artifacts', appId, 'stockLogs');

// =========================================================================
// window.posDb — API yang dipakai oleh js/state/*.js
// =========================================================================
window.posDb = {
    db,
    auth,
    appId,

    // --- AUTH ---
    // Email + Password, SAMA seperti YN Shop. TIDAK ADA fallback anonymous.
    async login(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
    },
    async logout() {
        await signOut(auth);
    },
    onAuthChange(callback) {
        return onAuthStateChanged(auth, callback);
    },

    // --- USER PROFILE (artifacts/{appId}/users/{uid}/profile/data) ---
    // Dokumen ini MILIK YN Shop. POS hanya membaca field yang relevan
    // (nama, email, role, status) dan TIDAK PERNAH membuat sistem user baru.
    async getUserProfile(uid) {
        const snap = await getDoc(userProfileRef(uid));
        return snap.exists() ? snap.data() : null;
    },
    // Update PARSIAL field milik POS di dalam dokumen profil YN Shop
    // (mis. posPin). Selalu merge — tidak pernah menimpa nama/role/status/dll.
    async updateOwnProfileField(uid, partialData) {
        await setDoc(userProfileRef(uid), partialData, { merge: true });
    },
    subscribeUserProfile(uid, callback) {
        return onSnapshot(userProfileRef(uid), (snap) => {
            callback(snap.exists() ? snap.data() : null);
        }, (err) => console.error('Error listening to user profile:', err));
    },

    // --- PRODUCTS (artifacts/{appId}/products) — SATU koleksi dengan YN Shop ---
    subscribeProducts(callback) {
        return onSnapshot(productsCol(), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data);
        }, (err) => {
            console.error('Error loading products:', err);
            callback(null, err);
        });
    },
    // Update PARSIAL (merge) — tidak pernah menimpa field milik YN Shop
    // (image, brand, promo, description, category, dst) yang tidak
    // dikelola form POS.
    async saveProductMerge(id, partialData) {
        await setDoc(productDocRef(id), partialData, { merge: true });
    },
    async addProduct(fullData) {
        const ref = await addDoc(productsCol(), fullData);
        return ref.id;
    },
    async deleteProduct(id) {
        await deleteDoc(productDocRef(id));
    },

    // --- STOK: transaksi atomic (sama seperti pola checkout.js YN Shop) ---
    // Dipakai baik untuk penjualan kasir maupun penyesuaian stok manual,
    // supaya aman terhadap perubahan stok bersamaan dari sisi website.
    async runStockTransaction(updater) {
        return runTransaction(db, updater);
    },
    productDocRef,

    // --- ORDERS (artifacts/{appId}/orders) — SATU koleksi dengan YN Shop ---
    // Order dari kasir & dari website hidup di koleksi yang SAMA, dibedakan
    // lewat field `source` ('pos' | 'online'). Struktur field mengikuti
    // dokumen order YN Shop (orderId, items, totalAmount, status, createdAt, dst)
    // ditambah field khusus POS (source, cashierId, cashierName, dst).
    subscribeOrders(callback) {
        return onSnapshot(ordersCol(), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data);
        }, (err) => console.error('Error loading orders:', err));
    },
    orderDocRef,

    // --- PENGATURAN PEMBAYARAN QRIS (settings/payment, top-level, read-only utk POS) ---
    subscribePaymentSettings(callback) {
        return onSnapshot(paymentSettingsRef(), (snap) => {
            callback(snap.exists() ? snap.data() : null);
        }, (err) => console.warn('Gagal memuat pengaturan pembayaran:', err));
    },

    // --- PENGATURAN TOKO POS (ekstensi POS, bukan milik YN Shop) ---
    subscribeStoreSettings(callback) {
        return onSnapshot(storeSettingsRef(), (snap) => {
            callback(snap.exists() ? snap.data() : null);
        }, (err) => console.warn('Gagal memuat pengaturan toko POS:', err));
    },
    async saveStoreSettings(data) {
        await setDoc(storeSettingsRef(), data, { merge: true });
    },

    // --- RIWAYAT STOK (ekstensi POS, bukan milik YN Shop) ---
    subscribeStockLogs(callback) {
        return onSnapshot(stockLogsCol(), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data);
        }, (err) => console.warn('Gagal memuat riwayat stok:', err));
    },
    async addStockLog(data) {
        await addDoc(stockLogsCol(), data);
    },

    serverTimestamp
};
