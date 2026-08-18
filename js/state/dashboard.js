// =========================================================================
// Dashboard State
// Berisi state & logika grafik penjualan mingguan (Chart.js) yang
// ditampilkan di halaman Dashboard. Identik dengan index.html asli.
// =========================================================================
function createDashboardState() {
    return {
        chartInstance: null,

        renderChart() {
            const ctx = document.getElementById('salesChart');
            if (!ctx) return;
            if (this.chartInstance) this.chartInstance.destroy();
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                    datasets: [{
                        label: 'Penjualan (Rp)',
                        data: [1200000, 1900000, 1500000, 2200000, 3000000, 4500000, 3800000],
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
        }
    };
}
