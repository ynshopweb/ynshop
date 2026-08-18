// =========================================================================
// Firebase Service (ES Module)
// Dipindahkan dari inline <script type="module"> di index.html asli.
// Semua logika koneksi & helper database TIDAK diubah, hanya dipisah
// ke file tersendiri agar konfigurasi Firebase mudah ditemukan/diganti.
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// MASUKKAN KONFIGURASI FIREBASE ANDA DI SINI
// Salin dari Firebase Console -> Project Settings -> General -> Your apps
// =========================================================================
const myFirebaseConfig = {
    apiKey: "AIzaSyAI40D0zGggLx8iuCOhePmIc2cwjaurMyQ",
    authDomain: "ynshopkasir.firebaseapp.com",
    projectId: "ynshopkasir",
    storageBucket: "ynshopkasir.firebasestorage.app",
    messagingSenderId: "201541584045",
    appId: "1:201541584045:web:313f99a08dbfbff0da3224",
    measurementId: "G-C3VSJB17DD"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'pos-ynshop';
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : (myFirebaseConfig.apiKey !== "AIzaSy..." ? myFirebaseConfig : null);

let db = null;
let auth = null;

if (firebaseConfig) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (err) {
        console.warn("Firebase Init Warning:", err);
    }
}

// Helper object global untuk komunikasi dengan Alpine.js
window.posDb = {
    db,
    auth,
    appId,
    async initAuth() {
        if (!auth) return null;
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
            return auth.currentUser?.uid || null;
        } catch (e) {
            console.error("Firebase Auth Error:", e);
            return null;
        }
    },
    subscribeCollection(colName, callback) {
        if (!db || !auth?.currentUser) return () => {};
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
        return onSnapshot(colRef, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data);
        }, (err) => {
            console.error(`Error loading ${colName}:`, err);
        });
    },
    async saveDoc(colName, id, data) {
        if (!db || !auth?.currentUser) return;
        const ref = doc(db, 'artifacts', appId, 'public', 'data', colName, String(id));
        await setDoc(ref, data, { merge: true });
    },
    async addDoc(colName, data) {
        if (!db || !auth?.currentUser) return;
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
        const res = await addDoc(colRef, data);
        return res.id;
    },
    async deleteDoc(colName, id) {
        if (!db || !auth?.currentUser) return;
        const ref = doc(db, 'artifacts', appId, 'public', 'data', colName, String(id));
        await deleteDoc(ref);
    }
};
