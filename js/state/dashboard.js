// =========================================================================
// Dashboard State
// -------------------------------------------------------------------------
// TAHAP INTEGRASI: grafik penjualan mingguan SEKARANG dihitung dari data
// nyata koleksi `orders` (transaksi kasir, source == 'pos') — angka
// hardcode demo yang sebelumnya ada di sini DIHAPUS sesuai instruksi
// "Laporan harus membaca transaksi nyata dari Firestore, jangan
// menggunakan angka hardcode."
// =========================================================================
function createDashboardState() {
    return {
        chartInstance: null,

        // 7 hari terakhir (termasuk hari ini), total transaksi kasir per hari.
        get weeklySalesData() {
            const days = [];
            const labels = [];
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
                days.push(d.getTime());
                labels.push(dayNames[d.getDay()]);
            }

            const totals = days.map(startOfDay => {
                const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
                return (this.orders || [])
                    .filter(o => o.source === 'pos' && (o.createdAt || 0) >= startOfDay && (o.createdAt || 0) < endOfDay)
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            });

            return { labels, totals };
        },

        renderChart() {
            const ctx = document.getElementById('salesChart');
            if (!ctx) return;
            if (this.chartInstance) this.chartInstance.destroy();

            const { labels, totals } = this.weeklySalesData;

            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Penjualan (Rp)',
                        data: totals,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });

            // Grafik perlu di-render ulang setiap kali data order berubah
            // (real-time), bukan sekali saat load halaman.
            this._chartWatcherSet = true;
        }
    };
}
