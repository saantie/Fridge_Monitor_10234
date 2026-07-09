// ========== Thai font (jsPDF's built-in fonts cannot render Thai script) ==========
// Pinned to a specific google/fonts commit so the CDN URL never changes shape.
const THAI_FONT_BASE = 'https://cdn.jsdelivr.net/gh/google/fonts@7d82a06388d70ec34312df7e7cede76ba8bbf7b5/ofl/sarabun/';
let thaiFontCache = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadThaiFontData() {
  if (thaiFontCache) return thaiFontCache;

  const [regularBuf, boldBuf] = await Promise.all([
    fetch(THAI_FONT_BASE + 'Sarabun-Regular.ttf').then(r => {
      if (!r.ok) throw new Error('โหลดฟอนต์ไม่สำเร็จ (Regular)');
      return r.arrayBuffer();
    }),
    fetch(THAI_FONT_BASE + 'Sarabun-Bold.ttf').then(r => {
      if (!r.ok) throw new Error('โหลดฟอนต์ไม่สำเร็จ (Bold)');
      return r.arrayBuffer();
    })
  ]);

  thaiFontCache = {
    regular: arrayBufferToBase64(regularBuf),
    bold: arrayBufferToBase64(boldBuf)
  };

  return thaiFontCache;
}

function registerThaiFont(doc, fontData) {
  doc.addFileToVFS('Sarabun-Regular.ttf', fontData.regular);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.addFileToVFS('Sarabun-Bold.ttf', fontData.bold);
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
  doc.setFont('Sarabun', 'normal');
}

// ========== Shared constants ==========
const THAI_MONTH_NAMES = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const CHILLER_COLOR_HEX = '#FF7043';
const CHILLER_COLOR_RGB = [255, 112, 67];
const FREEZER_COLOR_HEX = '#3F51B5';
const FREEZER_COLOR_RGB = [63, 81, 181];

// ========== Out-of-range event detection ==========
// "Standard" here is TEMP_STANDARD from charts.js (chiller +2~+8C, freezer -25~-15C),
// loaded before this script - shared as the single source of truth for what counts as an alert.
function isOutOfRange(type, value) {
  const range = TEMP_STANDARD[type];
  return value < range.min || value > range.max;
}

function estimateSamplingIntervalMs(sortedData) {
  if (sortedData.length < 2) return 30 * 60 * 1000;
  const gaps = [];
  for (let i = 1; i < sortedData.length; i++) {
    const gap = new Date(sortedData[i].timestamp) - new Date(sortedData[i - 1].timestamp);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 30 * 60 * 1000;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function detectOutOfRangeEvents(sortedData) {
  const samplingIntervalMs = estimateSamplingIntervalMs(sortedData);
  const events = [];
  const open = { chiller: null, freezer: null };

  const closeEvent = (type, endTimestamp) => {
    const ev = open[type];
    if (!ev) return;
    ev.end = endTimestamp;
    ev.durationMs = new Date(ev.end) - new Date(ev.start);
    events.push(ev);
    open[type] = null;
  };

  sortedData.forEach(record => {
    ['chiller', 'freezer'].forEach(type => {
      const value = parseFloat(record[type]);
      if (isNaN(value)) return;

      if (isOutOfRange(type, value)) {
        if (!open[type]) {
          open[type] = { type, start: record.timestamp, end: record.timestamp, minVal: value, maxVal: value, count: 1 };
        } else {
          open[type].minVal = Math.min(open[type].minVal, value);
          open[type].maxVal = Math.max(open[type].maxVal, value);
          open[type].count++;
        }
      } else if (open[type]) {
        closeEvent(type, record.timestamp);
      }
    });
  });

  // An event still open at the end of the month is extended by one sampling
  // interval, since we have no later reading to mark when it actually ended.
  ['chiller', 'freezer'].forEach(type => {
    if (open[type]) {
      const extendedEnd = new Date(new Date(open[type].end).getTime() + samplingIntervalMs).toISOString();
      closeEvent(type, extendedEnd);
    }
  });

  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} ชม. ${minutes} นาที`;
  if (hours > 0) return `${hours} ชม.`;
  return `${minutes} นาที`;
}

function formatDateTimeShort(timestamp) {
  const d = new Date(timestamp);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

// ========== Shared paginated table renderer ==========
function drawTableHeader(doc, columns, y, pageWidth) {
  doc.setFillColor(102, 126, 234);
  doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Sarabun', 'bold');
  doc.setFontSize(10);
  columns.forEach(col => doc.text(col.label, col.x, y));
  doc.setTextColor(0, 0, 0);
  doc.setFont('Sarabun', 'normal');
  doc.setFontSize(9);
}

function renderTable(doc, { columns, rows, yPos, pageWidth, pageHeight }) {
  drawTableHeader(doc, columns, yPos, pageWidth);
  yPos += 8;
  let rowCount = 0;

  rows.forEach(row => {
    if (yPos > pageHeight - 25) {
      doc.addPage();
      yPos = 20;
      drawTableHeader(doc, columns, yPos, pageWidth);
      yPos += 8;
      rowCount = 0;
    }

    if (rowCount % 2 === 0) {
      doc.setFillColor(247, 250, 252);
      doc.rect(20, yPos - 4, pageWidth - 40, 6, 'F');
    }
    rowCount++;

    row.forEach(cell => {
      doc.setTextColor(...(cell.color || [0, 0, 0]));
      doc.setFont('Sarabun', cell.bold ? 'bold' : 'normal');
      doc.text(String(cell.text), cell.x, yPos);
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont('Sarabun', 'normal');

    yPos += 6;
  });

  return yPos;
}

class PDFExporter {
  constructor() {
    this.currentDevice = null;
    this.monthlyData = null;
  }

  async generateMonthlyPDF(device, year, month) {
    try {
      showLoading();

      const response = await API.getMonthlyData(device.device_name, year, month);

      if (response.error) {
        throw new Error(response.error);
      }

      this.monthlyData = response;
      this.currentDevice = device;

      await this.createPDF();

      hideLoading();
    } catch (error) {
      showError('ไม่สามารถสร้าง PDF ได้: ' + error.message);
    }
  }

  async createPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    let fontData;
    try {
      fontData = await loadThaiFontData();
    } catch (error) {
      throw new Error('ไม่สามารถโหลดฟอนต์ภาษาไทยได้ (ต้องเชื่อมต่ออินเทอร์เน็ตอย่างน้อยครั้งแรก): ' + error.message);
    }
    registerThaiFont(doc, fontData);

    const data = this.monthlyData;
    const sortedRecords = [...data.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const events = detectOutOfRangeEvents(sortedRecords);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const primaryColor = [102, 126, 234];
    const successColor = [72, 187, 120];
    const dangerColor = [245, 101, 101];
    const grayColor = [128, 128, 128];

    // === PAGE 1: COVER & SUMMARY ===
    let yPos = 20;

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('Sarabun', 'bold');
    doc.text('รายงานอุณหภูมิตู้เย็น', pageWidth / 2, 18, { align: 'center' });

    const monthName = `${THAI_MONTH_NAMES[data.month - 1]} ${data.year + 543}`;

    doc.setFontSize(16);
    doc.setFont('Sarabun', 'normal');
    doc.text(monthName, pageWidth / 2, 28, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    yPos = 50;

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, yPos, pageWidth - 40, 18, 3, 3);

    yPos += 7;
    doc.setFontSize(12);
    doc.setFont('Sarabun', 'bold');
    doc.text('ข้อมูลอุปกรณ์', 25, yPos);

    yPos += 7;
    doc.setFont('Sarabun', 'normal');
    doc.text('ชื่อ: ' + this.currentDevice.device_name, 25, yPos);

    if (this.currentDevice.device_id) {
      doc.text('รหัส: ' + this.currentDevice.device_id, 120, yPos);
    }

    yPos += 15;

    doc.setDrawColor(...primaryColor);
    doc.setFillColor(247, 250, 252);
    doc.roundedRect(20, yPos, pageWidth - 40, 95, 3, 3, 'FD');

    yPos += 10;

    doc.setFontSize(16);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('สรุปข้อมูลรายเดือน', 25, yPos);
    doc.setTextColor(0, 0, 0);

    yPos += 10;
    doc.setFontSize(11);
    doc.setFont('Sarabun', 'normal');

    const summary = data.summary;

    doc.setFont('Sarabun', 'bold');
    doc.text('จำนวนข้อมูลทั้งหมด:', 25, yPos);
    doc.setFont('Sarabun', 'normal');
    doc.text(summary.total_records.toString(), 75, yPos);

    doc.setFont('Sarabun', 'bold');
    doc.text('จำนวนครั้งที่ผิดปกติ:', 115, yPos);
    doc.setFont('Sarabun', 'normal');

    if (summary.alert_count > 0) {
      doc.setTextColor(...dangerColor);
    } else {
      doc.setTextColor(...successColor);
    }
    doc.text(summary.alert_count.toString(), 160, yPos);
    doc.setTextColor(0, 0, 0);

    yPos += 12;

    doc.setFont('Sarabun', 'bold');
    doc.setFontSize(12);
    doc.text(`ช่องธรรมดา (มาตรฐาน +${TEMP_STANDARD.chiller.min}°C ถึง +${TEMP_STANDARD.chiller.max}°C)`, 25, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('Sarabun', 'normal');

    [
      `ค่าเฉลี่ย: ${summary.chiller_avg} °C`,
      `ค่าต่ำสุด: ${summary.chiller_min} °C`,
      `ค่าสูงสุด: ${summary.chiller_max} °C`
    ].forEach(line => {
      doc.text(line, 30, yPos);
      yPos += 6;
    });

    yPos += 5;

    doc.setFont('Sarabun', 'bold');
    doc.setFontSize(12);
    doc.text(`ช่องแช่แข็ง (มาตรฐาน ${TEMP_STANDARD.freezer.min}°C ถึง ${TEMP_STANDARD.freezer.max}°C)`, 25, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('Sarabun', 'normal');

    [
      `ค่าเฉลี่ย: ${summary.freezer_avg} °C`,
      `ค่าต่ำสุด: ${summary.freezer_min} °C`,
      `ค่าสูงสุด: ${summary.freezer_max} °C`
    ].forEach(line => {
      doc.text(line, 30, yPos);
      yPos += 6;
    });

    if (summary.alert_count > 0 && summary.total_records > 0) {
      yPos += 5;
      const alertPercent = ((summary.alert_count / summary.total_records) * 100).toFixed(1);
      doc.setFontSize(11);
      doc.setFont('Sarabun', 'bold');
      doc.setTextColor(...dangerColor);
      doc.text(`คำเตือน: พบอุณหภูมิผิดปกติ ${alertPercent}% ของข้อมูลทั้งหมด`, 25, yPos);
      doc.setTextColor(0, 0, 0);
    }

    // === PAGE 2: CHART ===
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('กราฟแนวโน้มอุณหภูมิ', 20, yPos);
    doc.setTextColor(0, 0, 0);

    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(20, yPos, 80, yPos);

    yPos += 10;

    try {
      const chartCanvas = await this.createChartForPDF(sortedRecords);
      const chartImage = chartCanvas.toDataURL('image/png');
      doc.addImage(chartImage, 'PNG', 15, yPos, pageWidth - 30, 110);
      yPos += 120;
    } catch (error) {
      console.error('Chart generation error:', error);
      doc.setFontSize(12);
      doc.setTextColor(...dangerColor);
      doc.text('ไม่สามารถสร้างกราฟได้', 20, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    }

    doc.setFontSize(9);
    doc.setFont('Sarabun', 'normal');
    doc.setTextColor(...grayColor);
    doc.text('* เส้นสีส้ม แสดงอุณหภูมิช่องธรรมดา', 20, yPos);
    yPos += 5;
    doc.text('* เส้นสีน้ำเงินคราม (เส้นประ) แสดงอุณหภูมิช่องแช่แข็ง', 20, yPos);
    doc.setTextColor(0, 0, 0);

    // === PAGE 3+: OUT-OF-RANGE EVENTS ===
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('เหตุการณ์อุณหภูมิผิดปกติ', 20, yPos);
    doc.setTextColor(0, 0, 0);

    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(20, yPos, 90, yPos);

    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('Sarabun', 'normal');
    doc.setTextColor(...grayColor);
    doc.text(
      `มาตรฐาน: ช่องธรรมดา +${TEMP_STANDARD.chiller.min}°C ถึง +${TEMP_STANDARD.chiller.max}°C | ช่องแช่แข็ง ${TEMP_STANDARD.freezer.min}°C ถึง ${TEMP_STANDARD.freezer.max}°C`,
      20, yPos
    );
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    if (events.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(...successColor);
      doc.text('ไม่พบเหตุการณ์อุณหภูมิผิดปกติในเดือนนี้', 20, yPos);
      doc.setTextColor(0, 0, 0);
    } else {
      const chillerEvents = events.filter(e => e.type === 'chiller');
      const freezerEvents = events.filter(e => e.type === 'freezer');
      const chillerTotalMs = chillerEvents.reduce((sum, e) => sum + e.durationMs, 0);
      const freezerTotalMs = freezerEvents.reduce((sum, e) => sum + e.durationMs, 0);

      doc.setFontSize(10);
      doc.setFont('Sarabun', 'normal');
      doc.text(`ช่องธรรมดา: ${chillerEvents.length} เหตุการณ์ รวม ${formatDuration(chillerTotalMs)}`, 20, yPos);
      yPos += 6;
      doc.text(`ช่องแช่แข็ง: ${freezerEvents.length} เหตุการณ์ รวม ${formatDuration(freezerTotalMs)}`, 20, yPos);
      yPos += 10;

      const eventColumns = [
        { label: 'ประเภท', x: 22 },
        { label: 'เริ่มต้น', x: 48 },
        { label: 'สิ้นสุด', x: 82 },
        { label: 'ระยะเวลา', x: 116 },
        { label: 'ต่ำสุด/สูงสุด', x: 152 }
      ];

      const eventRows = events.map(ev => [
        { text: ev.type === 'chiller' ? 'ช่องธรรมดา' : 'ช่องแช่แข็ง', x: 22, color: ev.type === 'chiller' ? CHILLER_COLOR_RGB : FREEZER_COLOR_RGB, bold: true },
        { text: formatDateTimeShort(ev.start), x: 48 },
        { text: formatDateTimeShort(ev.end), x: 82 },
        { text: formatDuration(ev.durationMs), x: 116 },
        { text: `${ev.minVal.toFixed(1)} / ${ev.maxVal.toFixed(1)} °C`, x: 152 }
      ]);

      renderTable(doc, { columns: eventColumns, rows: eventRows, yPos, pageWidth, pageHeight });
    }

    // === PAGE N+: FULL MONTH RECORDS TABLE ===
    doc.addPage();
    yPos = 20;

    doc.setFontSize(18);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('ข้อมูลอุณหภูมิรายละเอียด', 20, yPos);
    doc.setTextColor(0, 0, 0);

    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(20, yPos, 90, yPos);

    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('Sarabun', 'normal');
    doc.setTextColor(...grayColor);
    doc.text(`ข้อมูลทั้งหมด ${sortedRecords.length} รายการ (ทั้งเดือน)`, 20, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    const recordColumns = [
      { label: 'วันที่/เวลา', x: 25 },
      { label: 'ช่องธรรมดา', x: 75 },
      { label: 'ช่องแช่แข็ง', x: 115 },
      { label: 'สถานะ', x: 155 }
    ];

    const recordRows = sortedRecords.map(record => {
      const chiller = parseFloat(record.chiller);
      const freezer = parseFloat(record.freezer);
      const alert = isOutOfRange('chiller', chiller) || isOutOfRange('freezer', freezer);

      return [
        { text: formatDateTimeShort(record.timestamp), x: 25 },
        { text: chiller.toFixed(1) + ' °C', x: 75 },
        { text: freezer.toFixed(1) + ' °C', x: 115 },
        { text: alert ? 'ผิดปกติ' : 'ปกติ', x: 155, color: alert ? dangerColor : successColor, bold: true }
      ];
    });

    renderTable(doc, { columns: recordColumns, rows: recordRows, yPos, pageWidth, pageHeight });

    // === FOOTER ON ALL PAGES ===
    const totalPages = doc.internal.pages.length - 1;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...grayColor);

      doc.setDrawColor(...grayColor);
      doc.setLineWidth(0.3);
      doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);

      const timestamp = new Date().toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      doc.text(`สร้างเมื่อ: ${timestamp}`, 20, pageHeight - 10);
      doc.text(`หน้า ${i} จาก ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    // Save PDF (filename stays ASCII-safe regardless of Thai device names)
    const deviceNameEn = this.cleanDeviceName(this.currentDevice.device_name);
    const filename = this.generateFilename(deviceNameEn, data.year, data.month);
    doc.save(filename);

    console.log('PDF generated successfully:', filename);
  }

  cleanDeviceName(name) {
    // Remove all non-ASCII characters (only used for the downloaded filename;
    // Thai text renders fine inside the PDF itself via the embedded font).
    let cleanName = name.replace(/[^\x00-\x7F]/g, '').trim();

    if (!cleanName || cleanName.length === 0) {
      cleanName = this.currentDevice.device_id || 'Unknown';
    }

    cleanName = cleanName.replace(/[^a-zA-Z0-9\-_\s]/g, '');

    return cleanName.trim() || 'Fridge';
  }

  generateFilename(deviceName, year, month) {
    const cleanName = deviceName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const monthPadded = String(month).padStart(2, '0');
    return `FridgeReport_${cleanName}_${year}-${monthPadded}.pdf`;
  }

  async createChartForPDF(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 550;

    const ctx = canvas.getContext('2d');

    let sampledData = data;
    if (data.length > 100) {
      const step = Math.floor(data.length / 100);
      sampledData = data.filter((_, index) => index % step === 0);
    }

    const timestamps = sampledData.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    const chillerData = sampledData.map(d => parseFloat(d.chiller));
    const freezerData = sampledData.map(d => parseFloat(d.freezer));

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [
          {
            label: 'ช่องธรรมดา (°C)',
            data: chillerData,
            borderColor: CHILLER_COLOR_HEX,
            borderWidth: 3,
            pointStyle: 'circle',
            pointRadius: 2,
            pointBackgroundColor: CHILLER_COLOR_HEX,
            tension: 0.4,
            fill: false
          },
          {
            label: 'ช่องแช่แข็ง (°C)',
            data: freezerData,
            borderColor: FREEZER_COLOR_HEX,
            borderDash: [6, 4],
            borderWidth: 3,
            pointStyle: 'triangle',
            pointRadius: 2,
            pointBackgroundColor: FREEZER_COLOR_HEX,
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 14 },
              usePointStyle: true,
              padding: 15
            }
          },
          title: { display: false },
          annotation: {
            annotations: {
              chillerZone: {
                type: 'box',
                yMin: TEMP_STANDARD.chiller.min,
                yMax: TEMP_STANDARD.chiller.max,
                backgroundColor: `rgba(${TEMP_STANDARD.chiller.color}, 0.12)`,
                borderColor: `rgba(${TEMP_STANDARD.chiller.color}, 0.5)`,
                borderWidth: 1,
                borderDash: [4, 4]
              },
              freezerZone: {
                type: 'box',
                yMin: TEMP_STANDARD.freezer.min,
                yMax: TEMP_STANDARD.freezer.max,
                backgroundColor: `rgba(${TEMP_STANDARD.freezer.color}, 0.12)`,
                borderColor: `rgba(${TEMP_STANDARD.freezer.color}, 0.5)`,
                borderWidth: 1,
                borderDash: [4, 4]
              }
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
              text: 'อุณหภูมิ (°C)',
              font: { size: 14, weight: 'bold' }
            },
            ticks: { font: { size: 12 } },
            grid: { color: 'rgba(0, 0, 0, 0.1)' }
          },
          x: {
            title: {
              display: true,
              text: 'วันที่/เวลา',
              font: { size: 14, weight: 'bold' }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: { size: 10 }
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          }
        }
      }
    });

    return canvas;
  }
}

const pdfExporter = new PDFExporter();
