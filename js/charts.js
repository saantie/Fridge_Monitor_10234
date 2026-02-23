class TempChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  create(data) {
    const timestamps = data.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleString('th-TH', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    });

    const chillerData = data.map(d => d.chiller);
    const freezerData = data.map(d => d.freezer);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.canvas, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [
          {
            label: 'Chiller (°C)',
            data: chillerData,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Freezer (°C)',
            data: freezerData,
            borderColor: '#00BCD4',
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'อุณหภูมิ (°C)'
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
