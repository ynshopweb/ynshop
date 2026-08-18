// =========================================================================
// Konfigurasi Tailwind CSS (CDN)
// Dipindahkan dari inline <script> di index.html asli, isi tidak diubah.
// Harus dimuat SETELAH <script src="https://cdn.tailwindcss.com"> dan
// SEBELUM elemen di-render, karena tailwind CDN membaca window.tailwind.
// =========================================================================
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8'
                }
            }
        }
    }
};
