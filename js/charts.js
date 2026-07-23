// ========== มาตรฐานช่วงอุณหภูมิ (Cold Chain Standard) ==========
// ช่องธรรมดา (Chiller): +2°C ถึง +8°C
// ช่องแช่แข็ง (Freezer): -25°C ถึง -15°C
const TEMP_STANDARD = {
  chiller: { min: 2, max: 8, label: 'ช่องธรรมดา (+2°C ถึง +8°C)', color: '76, 175, 80' },   // เขียว
  freezer: { min: -25, max: -15, label: 'ช่องแช่แข็ง (-25°C ถึง -15°C)', color: '3, 169, 244' } // ฟ้า
};

// Alternating day-divider bands, so a multi-day chart (7-day / month view) reads
// as distinct days at a glance instead of one continuous unbroken line. Boundaries
// sit halfway between the last point of one day and the first point of the next,
// using fractional category-scale indices - works whether the day has 1 point or 200.
function buildDayBandAnnotations(data) {
  const days = [];
  let lastKey = null;

  data.forEach((d, index) => {
    const date = new Date(d.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (key !== lastKey) {
      days.push({ startIndex: index });
      lastKey = key;
    }
  });

  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bandColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(45, 55, 72, 0.05)';

  const annotations = {};
  days.forEach((day, i) => {
    if (i % 2 !== 0) return; // shade every other day
    const nextStart = days[i + 1] ? days[i + 1].startIndex : data.length;
    annotations[`dayBand${i}`] = {
      type: 'box',
      xMin: Math.max(day.startIndex - 0.5, 0),
      xMax: nextStart - 0.5,
      backgroundColor: bandColor,
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw'
    };
  });

  return annotations;
}

class TempChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  create(data, { showDayBands = false } = {}) {
    // A full month of readings can be thousands of points - sample down so
    // the chart stays responsive; pan/zoom lets users inspect any stretch closely.
    const MAX_POINTS = 500;
    if (data.length > MAX_POINTS) {
      const step = Math.ceil(data.length / MAX_POINTS);
      data = data.filter((_, index) => index % step === 0);
    }

    const dayBandAnnotations = showDayBands ? buildDayBandAnnotations(data) : {};

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
              ...dayBandAnnotations,
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
