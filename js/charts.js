// ========== มาตรฐานช่วงอุณหภูมิ (Cold Chain Standard) ==========
// ช่องธรรมดา (Chiller): +2°C ถึง +8°C
// ช่องแช่แข็ง (Freezer): -25°C ถึง -15°C
const TEMP_STANDARD = {
  chiller: { min: 2, max: 8, label: 'ช่องธรรมดา (+2°C ถึง +8°C)', color: '76, 175, 80' },   // เขียว
  freezer: { min: -25, max: -15, label: 'ช่องแช่แข็ง (-25°C ถึง -15°C)', color: '3, 169, 244' } // ฟ้า
};

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
            borderColor: '#FF7043',
            borderWidth: 2,
            borderDash: [],
            pointStyle: 'circle',
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#FF7043',
            tension: 0.4,
            fill: false
          },
          {
            label: 'Freezer (°C)',
            data: freezerData,
            borderColor: '#3F51B5',
            borderWidth: 2,
            borderDash: [6, 4],
            pointStyle: 'triangle',
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3F51B5',
            tension: 0.4,
            fill: false
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
          },
          annotation: {
            annotations: {
              chillerZone: {
                type: 'box',
                yMin: TEMP_STANDARD.chiller.min,
                yMax: TEMP_STANDARD.chiller.max,
                backgroundColor: `rgba(${TEMP_STANDARD.chiller.color}, 0.12)`,
                borderColor: `rgba(${TEMP_STANDARD.chiller.color}, 0.5)`,
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                  display: true,
                  content: TEMP_STANDARD.chiller.label,
                  position: { x: 'end', y: 'start' },
                  backgroundColor: `rgba(${TEMP_STANDARD.chiller.color}, 0.85)`,
                  color: '#000',
                  font: { size: 10, weight: 'bold' },
                  padding: 4
                }
              },
              freezerZone: {
                type: 'box',
                yMin: TEMP_STANDARD.freezer.min,
                yMax: TEMP_STANDARD.freezer.max,
                backgroundColor: `rgba(${TEMP_STANDARD.freezer.color}, 0.12)`,
                borderColor: `rgba(${TEMP_STANDARD.freezer.color}, 0.5)`,
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                  display: true,
                  content: TEMP_STANDARD.freezer.label,
                  position: { x: 'end', y: 'end' },
                  backgroundColor: `rgba(${TEMP_STANDARD.freezer.color}, 0.85)`,
                  color: '#000',
                  font: { size: 10, weight: 'bold' },
                  padding: 4
                }
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x'
            },
            limits: {
              x: { minRange: 5 }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: TEMP_STANDARD.freezer.min - 5,
            suggestedMax: TEMP_STANDARD.chiller.max + 5,
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

  resetZoom() {
    if (this.chart) {
      this.chart.resetZoom();
    }
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
