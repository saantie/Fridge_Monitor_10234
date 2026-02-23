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
      showError('Cannot generate PDF: ' + error.message);
    }
  }

  async createPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const data = this.monthlyData;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Colors
    const primaryColor = [102, 126, 234]; // #667eea
    const successColor = [72, 187, 120];  // #48bb78
    const dangerColor = [245, 101, 101];  // #f56565
    const grayColor = [128, 128, 128];
    
    // === PAGE 1: COVER & SUMMARY ===
    let yPos = 20;
    
    // Header box
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('FRIDGE TEMPERATURE REPORT', pageWidth / 2, 18, { align: 'center' });
    
    // Month/Year
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[data.month - 1] + ' ' + data.year;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(monthName, pageWidth / 2, 28, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPos = 50;
    
    // Device info box
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, yPos, pageWidth - 40, 18, 3, 3);
    
    yPos += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Device Information', 25, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const deviceNameEn = this.cleanDeviceName(this.currentDevice.device_name);
    doc.text('Name: ' + deviceNameEn, 25, yPos);
    
    if (this.currentDevice.device_id) {
      const deviceId = this.currentDevice.device_id;
      doc.text('ID: ' + deviceId, 120, yPos);
    }
    
    yPos += 15;
    
    // Summary box
    doc.setDrawColor(...primaryColor);
    doc.setFillColor(247, 250, 252); // Light blue background
    doc.roundedRect(20, yPos, pageWidth - 40, 95, 3, 3, 'FD');
    
    yPos += 10;
    
    // Summary Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('MONTHLY SUMMARY', 25, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const summary = data.summary;
    
    // Key metrics
    doc.setFont('helvetica', 'bold');
    doc.text('Total Records:', 25, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(summary.total_records.toString(), 70, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Alert Count:', 110, yPos);
    doc.setFont('helvetica', 'normal');
    
    // Alert count in red if > 0
    if (summary.alert_count > 0) {
      doc.setTextColor(...dangerColor);
    } else {
      doc.setTextColor(...successColor);
    }
    doc.text(summary.alert_count.toString(), 145, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 12;
    
    // Chiller section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CHILLER (Target: 2-8 C)', 25, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const chillerLines = [
      `Average: ${summary.chiller_avg} C`,
      `Minimum: ${summary.chiller_min} C`,
      `Maximum: ${summary.chiller_max} C`
    ];
    
    chillerLines.forEach(line => {
      doc.text(line, 30, yPos);
      yPos += 6;
    });
    
    yPos += 5;
    
    // Freezer section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('FREEZER (Target: -20 to -10 C)', 25, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const freezerLines = [
      `Average: ${summary.freezer_avg} C`,
      `Minimum: ${summary.freezer_min} C`,
      `Maximum: ${summary.freezer_max} C`
    ];
    
    freezerLines.forEach(line => {
      doc.text(line, 30, yPos);
      yPos += 6;
    });
    
    // Alert percentage
    if (summary.alert_count > 0 && summary.total_records > 0) {
      yPos += 5;
      const alertPercent = ((summary.alert_count / summary.total_records) * 100).toFixed(1);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...dangerColor);
      doc.text(`WARNING: ${alertPercent}% of records had temperature alerts`, 25, yPos);
      doc.setTextColor(0, 0, 0);
    }
    
    // === PAGE 2: CHART ===
    doc.addPage();
    yPos = 20;
    
    // Chart title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('TEMPERATURE TREND', 20, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(20, yPos, 80, yPos);
    
    yPos += 10;
    
    // Create chart
    try {
      const chartCanvas = await this.createChartForPDF(data.data);
      const chartImage = chartCanvas.toDataURL('image/png');
      doc.addImage(chartImage, 'PNG', 15, yPos, pageWidth - 30, 110);
      yPos += 120;
    } catch (error) {
      console.error('Chart generation error:', error);
      doc.setFontSize(12);
      doc.setTextColor(...dangerColor);
      doc.text('Chart generation failed', 20, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    }
    
    // Legend
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text('* Blue line represents Chiller temperature', 20, yPos);
    yPos += 5;
    doc.text('* Cyan line represents Freezer temperature', 20, yPos);
    doc.setTextColor(0, 0, 0);
    
    // === PAGE 3+: DATA TABLE ===
    doc.addPage();
    yPos = 20;
    
    // Table title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('TEMPERATURE RECORDS', 20, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(20, yPos, 90, yPos);
    
    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...grayColor);
    doc.text('Showing last 50 records', 20, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 8;
    
    // Table header background
    doc.setFillColor(102, 126, 234);
    doc.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
    
    // Table header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DATE/TIME', 25, yPos);
    doc.text('CHILLER', 75, yPos);
    doc.text('FREEZER', 115, yPos);
    doc.text('STATUS', 155, yPos);
    
    yPos += 8;
    doc.setTextColor(0, 0, 0);
    
    // Table data
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    const recentData = data.data.slice(-50);
    let rowCount = 0;
    
    recentData.forEach((record) => {
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 20;
        
        // Repeat header
        doc.setFillColor(102, 126, 234);
        doc.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DATE/TIME', 25, yPos);
        doc.text('CHILLER', 75, yPos);
        doc.text('FREEZER', 115, yPos);
        doc.text('STATUS', 155, yPos);
        
        yPos += 8;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        rowCount = 0;
      }
      
      // Alternate row background
      if (rowCount % 2 === 0) {
        doc.setFillColor(247, 250, 252);
        doc.rect(20, yPos - 4, pageWidth - 40, 6, 'F');
      }
      rowCount++;
      
      const timestamp = record.timestamp.substring(5, 16); // MM-DD HH:MM
      const chiller = parseFloat(record.chiller).toFixed(1);
      const freezer = parseFloat(record.freezer).toFixed(1);
      
      // Check alert status
      let status = 'OK';
      let statusColor = successColor;
      
      if (record.chiller < 2 || record.chiller > 8 || 
          record.freezer < -20 || record.freezer > -10) {
        status = 'ALERT';
        statusColor = dangerColor;
      }
      
      doc.setTextColor(0, 0, 0);
      doc.text(timestamp, 25, yPos);
      doc.text(chiller + ' C', 75, yPos);
      doc.text(freezer + ' C', 115, yPos);
      
      doc.setTextColor(...statusColor);
      doc.setFont('helvetica', 'bold');
      doc.text(status, 155, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      yPos += 6;
    });
    
    // === FOOTER ON ALL PAGES ===
    const totalPages = doc.internal.pages.length - 1;
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Bottom border
      doc.setDrawColor(...grayColor);
      doc.setLineWidth(0.3);
      doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
      
      // Footer text
      const timestamp = new Date().toLocaleString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      doc.text(`Generated: ${timestamp}`, 20, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }
    
    // Save PDF
    const filename = this.generateFilename(deviceNameEn, data.year, data.month);
    doc.save(filename);
    
    console.log('PDF generated successfully:', filename);
  }

  cleanDeviceName(name) {
    // Remove all non-ASCII characters
    let cleanName = name.replace(/[^\x00-\x7F]/g, '').trim();
    
    // If empty after cleaning, use device ID
    if (!cleanName || cleanName.length === 0) {
      cleanName = this.currentDevice.device_id || 'Unknown';
    }
    
    // Remove special characters except hyphen and underscore
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
    
    // Sample data if too many points
    let sampledData = data;
    if (data.length > 100) {
      const step = Math.floor(data.length / 100);
      sampledData = data.filter((_, index) => index % step === 0);
    }
    
    const timestamps = sampledData.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleDateString('en-US', { 
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
            label: 'Chiller (C)',
            data: chillerData,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 2,
            pointBackgroundColor: '#667eea'
          },
          {
            label: 'Freezer (C)',
            data: freezerData,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 2,
            pointBackgroundColor: '#06b6d4'
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
              font: {
                size: 14,
                family: 'helvetica'
              },
              usePointStyle: true,
              padding: 15
            }
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Temperature (Celsius)',
              font: {
                size: 14,
                weight: 'bold',
                family: 'helvetica'
              }
            },
            ticks: {
              font: {
                size: 12,
                family: 'helvetica'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date/Time',
              font: {
                size: 14,
                weight: 'bold',
                family: 'helvetica'
              }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: {
                size: 10,
                family: 'helvetica'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    });
    
    return canvas;
  }
}

const pdfExporter = new PDFExporter();
