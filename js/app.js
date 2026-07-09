/**
 * ========================================
 * Fridge Monitor PWA - Main Application
 * ========================================
 */

// ========== STATE MANAGEMENT ==========
let currentDevice = null;
let tempChart = null;
let deferredPrompt = null;

// ========== DOM ELEMENTS ==========
const appVersionEl = document.getElementById('appVersion');
if (appVersionEl) appVersionEl.textContent = APP_VERSION;

const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const errorText = document.getElementById('errorText');
const devicesList = document.getElementById('devicesList');
const deviceDetail = document.getElementById('deviceDetail');

// Header buttons
const refreshBtn = document.getElementById('refreshBtn');
const notificationBtn = document.getElementById('notificationBtn');
const notificationBadge = document.getElementById('notificationBadge');

// Device detail
const backBtn = document.getElementById('backBtn');
const editNameBtn = document.getElementById('editNameBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const deviceTitle = document.getElementById('deviceTitle');
const resetZoomBtn = document.getElementById('resetZoomBtn');

// Temperature display
const chillerTemp = document.getElementById('chillerTemp');
const freezerTemp = document.getElementById('freezerTemp');
const chillerStatus = document.getElementById('chillerStatus');
const freezerStatus = document.getElementById('freezerStatus');
const lastUpdate = document.getElementById('lastUpdate');

// Modals
const editModal = document.getElementById('editModal');
const exportModal = document.getElementById('exportModal');
const notificationModal = document.getElementById('notificationModal');

// Edit name modal
const newNameInput = document.getElementById('newNameInput');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveNameBtn = document.getElementById('saveNameBtn');

// Export modal
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const generatePdfBtn = document.getElementById('generatePdfBtn');

// Month picker (historical chart view)
const monthPicker = document.getElementById('monthPicker');
const chartMonthSelect = document.getElementById('chartMonthSelect');
const chartYearSelect = document.getElementById('chartYearSelect');
const viewMonthBtn = document.getElementById('viewMonthBtn');

// Notification modal
const notificationToggle = document.getElementById('notificationToggle');
const notificationStatus = document.getElementById('notificationStatus');
const notificationStatusText = document.getElementById('notificationStatusText');
const closeNotificationBtn = document.getElementById('closeNotificationBtn');

// Install prompt
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBtn');

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Fridge Monitor PWA Starting...');
  initApp();
  registerServiceWorker();
  setupInstallPrompt();
  initNotifications();
  populateYearSelect();
  populateChartYearSelect();
});

/**
 * Initialize Application
 */
async function initApp() {
  console.log('📱 Initializing app...');
  
  // Load devices on start
  await loadDevices();
  
  // Setup event listeners
  setupEventListeners();

  // Start onboarding if needed (เพิ่มบรรทัดนี้)
  setTimeout(() => {
    onboardingManager.start();
  }, 1000);
  
  console.log('✅ App initialized');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Header buttons
  refreshBtn.addEventListener('click', handleRefresh);
  notificationBtn.addEventListener('click', showNotificationModal);
  
  // Device detail
  backBtn.addEventListener('click', showDevicesList);
  editNameBtn.addEventListener('click', showEditModal);
  exportPdfBtn.addEventListener('click', showExportModal);
  resetZoomBtn.addEventListener('click', () => {
    if (tempChart) tempChart.resetZoom();
  });
  
  // Edit name modal
  cancelEditBtn.addEventListener('click', hideEditModal);
  saveNameBtn.addEventListener('click', saveDeviceName);
  
  // Export modal
  cancelExportBtn.addEventListener('click', hideExportModal);
  generatePdfBtn.addEventListener('click', generatePDF);
  
  // Notification modal
  closeNotificationBtn.addEventListener('click', hideNotificationModal);
  notificationToggle.addEventListener('change', toggleNotifications);
  
  // Install prompt
  installBtn.addEventListener('click', handleInstall);
  dismissBtn.addEventListener('click', dismissInstallPrompt);
  
  // Month picker (historical chart view)
  viewMonthBtn.addEventListener('click', handleViewMonth);

  // Time range buttons
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', handleTimeRangeChange);
    // ที่บรรทัดท้ายสุดของ setupEventListeners()
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'openSettingsBtn') {
    openAndroidSettings(); }  });
  });
}

// ========== SERVICE WORKER ==========
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // A new SW calls skipWaiting()/clients.claim() automatically, so once it
    // takes control, reload once to pick up the latest app shell everywhere.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('🔄 New Service Worker activated - reloading for latest version');
      window.location.reload();
    });

    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service Worker update found');
        });

        // The browser only checks for a new sw.js on navigation / roughly
        // every 24h by default - force a check whenever the app becomes
        // active so updates are picked up as soon as possible.
        registration.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        });
        setInterval(() => registration.update(), 30 * 60 * 1000); // every 30 min
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  }
}

// ========== INSTALL PROMPT ==========
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPrompt.classList.remove('hidden');
    console.log('📱 Install prompt available');
  });
  
  // Track successful installation
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    installPrompt.classList.add('hidden');
    deferredPrompt = null;
  });
}

async function handleInstall() {
  if (!deferredPrompt) {
    console.warn('⚠️ No install prompt available');
    return;
  }
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  console.log(`👤 User choice: ${outcome}`);
  
  if (outcome === 'accepted') {
    console.log('✅ User accepted install');
  } else {
    console.log('❌ User dismissed install');
  }
  
  deferredPrompt = null;
  installPrompt.classList.add('hidden');
}

function dismissInstallPrompt() {
  installPrompt.classList.add('hidden');
  console.log('🙈 Install prompt dismissed');
}

// ========== NOTIFICATIONS ==========
async function initNotifications() {
  try {
    const initialized = await notificationManager.init();
    if (initialized) {
      notificationManager.setupForegroundNotifications();
      console.log('✅ Notifications initialized');
    }
  } catch (error) {
    console.error('❌ Notification init failed:', error);
  }
}

async function toggleNotifications(e) {
  try {
    if (e.target.checked) {
      const success = await notificationManager.enable();
      if (!success) {
        e.target.checked = false;
        showError('ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาตรวจสอบการตั้งค่า Browser');
      } else {
        console.log('✅ Notifications enabled');
      }
    } else {
      await notificationManager.disable();
      console.log('🔕 Notifications disabled');
    }
  } catch (error) {
    console.error('❌ Toggle notification failed:', error);
    e.target.checked = false;
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
}

// ========== DATA LOADING ==========
async function loadDevices() {
  try {
    showLoading();
    console.log('📥 Loading devices...');
    
    const response = await API.getLatestStatus();
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    console.log(`✅ Loaded ${response.devices.length} devices`);
    displayDevices(response.devices);
    
  } catch (error) {
    console.error('❌ Load devices failed:', error);
    showError('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
  } finally {
    hideLoading();
  }
}

function displayDevices(devices) {
  devicesList.innerHTML = '';
  
  if (devices.length === 0) {
    devicesList.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <p style="font-size: 3rem;">📭</p>
        <p style="font-size: 1.2rem; margin-top: 1rem;">ยังไม่มีเครื่องในระบบ</p>
        <p style="margin-top: 0.5rem;">รออุปกรณ์ส่งข้อมูลมาครั้งแรก</p>
      </div>
    `;
    return;
  }
  
  devices.forEach(device => {
    const card = createDeviceCard(device);
    devicesList.appendChild(card);
  });
}

function createDeviceCard(device) {
  const card = document.createElement('div');
  card.className = 'device-card';
  
  const latest = device.latest_data;
  let chillerStatus = 'normal';
  let freezerStatus = 'normal';
  let overallStatus = 'normal';
  
  if (latest) {
    chillerStatus = getAlertLevel(latest.chiller, 'chiller');
    freezerStatus = getAlertLevel(latest.freezer, 'freezer');
    overallStatus = chillerStatus === 'critical' || freezerStatus === 'critical' ? 'critical' :
                    chillerStatus === 'warning' || freezerStatus === 'warning' ? 'warning' : 'normal';
  }
  
  card.innerHTML = `
    <div class="device-card-header">
      <h3>${escapeHtml(device.device_name)}</h3>
      <span class="device-status ${overallStatus}"></span>
    </div>
    <div class="device-temps">
      <div class="device-temp">
        <div class="device-temp-label">Chiller</div>
        <div class="device-temp-value ${chillerStatus}">
          ${latest ? latest.chiller.toFixed(1) : '--'}°C
        </div>
      </div>
      <div class="device-temp">
        <div class="device-temp-label">Freezer</div>
        <div class="device-temp-value ${freezerStatus}">
          ${latest ? latest.freezer.toFixed(1) : '--'}°C
        </div>
      </div>
    </div>
    ${device.location !== '-' ? `<div class="device-location">📍 ${escapeHtml(device.location)}</div>` : ''}
    <div class="device-last-update">
      🕐 ${latest ? formatTimestamp(latest.timestamp) : 'ไม่มีข้อมูล'}
    </div>
  `;
  
  card.addEventListener('click', () => showDeviceDetail(device));
  
  return card;
}

// ========== DEVICE DETAIL ==========
async function showDeviceDetail(device) {
  console.log('📊 Opening device detail:', device.device_name);
  
  currentDevice = device;
  devicesList.classList.add('hidden');
  deviceDetail.classList.remove('hidden');
  
  deviceTitle.textContent = device.device_name;
  
  if (device.latest_data) {
    updateCurrentTemp(device.latest_data);
  }

  // Reset the range selector back to its default (24h) state each time a
  // device is opened, in case the month picker was left open previously.
  monthPicker.classList.add('hidden');
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.hours === '24');
  });

  await loadDeviceData(device, 24);
}

async function loadDeviceData(device, hours) {
  try {
    showLoading();
    console.log(`📊 Loading ${hours}h data for ${device.device_name}...`);
    
    const response = await API.getDeviceData(device.device_name, hours);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    if (!tempChart) {
      tempChart = new TempChart('tempChart');
    }
    
    tempChart.create(response.data);
    console.log(`✅ Loaded ${response.data.length} data points`);
    
  } catch (error) {
    console.error('❌ Load device data failed:', error);
    showError('ไม่สามารถโหลดข้อมูลกราฟได้: ' + error.message);
  } finally {
    hideLoading();
  }
}

async function loadDeviceMonthData(device, year, month) {
  try {
    showLoading();
    console.log(`📊 Loading ${year}-${month} data for ${device.device_name}...`);

    const response = await API.getMonthlyData(device.device_name, year, month);

    if (response.error) {
      throw new Error(response.error);
    }

    if (!tempChart) {
      tempChart = new TempChart('tempChart');
    }

    if (!response.data || response.data.length === 0) {
      tempChart.create([]);
      showError('ไม่มีข้อมูลของเดือนที่เลือก');
      return;
    }

    tempChart.create(response.data);
    console.log(`✅ Loaded ${response.data.length} data points`);

  } catch (error) {
    console.error('❌ Load monthly data failed:', error);
    showError('ไม่สามารถโหลดข้อมูลย้อนหลังได้: ' + error.message);
  } finally {
    hideLoading();
  }
}

function updateCurrentTemp(data) {
  chillerTemp.textContent = data.chiller.toFixed(1);
  freezerTemp.textContent = data.freezer.toFixed(1);
  
  const chillerLevel = getAlertLevel(data.chiller, 'chiller');
  const freezerLevel = getAlertLevel(data.freezer, 'freezer');
  
  chillerStatus.className = `temp-status ${chillerLevel}`;
  chillerStatus.textContent = getStatusText(chillerLevel);
  
  freezerStatus.className = `temp-status ${freezerLevel}`;
  freezerStatus.textContent = getStatusText(freezerLevel);
  
  lastUpdate.textContent = formatTimestamp(data.timestamp);
}

function showDevicesList() {
  console.log('📱 Back to devices list');
  
  deviceDetail.classList.add('hidden');
  devicesList.classList.remove('hidden');
  
  if (tempChart) {
    tempChart.destroy();
    tempChart = null;
  }
  
  loadDevices();
}

// ========== TEMPERATURE HELPERS ==========
function getAlertLevel(temp, type) {
  // TEMP_STANDARD (charts.js): chiller +2~+8C, freezer -25~-15C - the same
  // standard used for the chart zone bands and the PDF report.
  const range = TEMP_STANDARD[type];
  const warningBuffer = type === 'chiller' ? 3 : 5;

  if (temp < range.min - warningBuffer || temp > range.max + warningBuffer) {
    return 'critical';
  }
  if (temp < range.min || temp > range.max) {
    return 'warning';
  }
  return 'normal';
}

function getStatusText(level) {
  switch (level) {
    case 'normal': return '✓ ปกติ';
    case 'warning': return '⚠ เตือน';
    case 'critical': return '🚨 วิกฤต';
    default: return '';
  }
}

// ========== TIME RANGE ==========
function handleTimeRangeChange(e) {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  e.target.classList.add('active');

  // "ย้อนหลังเป็นเดือน" just reveals the month/year picker - it doesn't
  // fetch anything until the user confirms with "ดูข้อมูล".
  if (e.target.dataset.hours === 'month') {
    monthPicker.classList.remove('hidden');
    return;
  }

  monthPicker.classList.add('hidden');

  const hours = parseInt(e.target.dataset.hours);
  console.log(`⏱️ Changed time range to ${hours} hours`);

  if (currentDevice) {
    loadDeviceData(currentDevice, hours);
  }
}

function handleViewMonth() {
  if (!currentDevice) return;

  const year = parseInt(chartYearSelect.value);
  const month = parseInt(chartMonthSelect.value);
  console.log(`⏱️ Changed chart range to ${year}-${month}`);

  loadDeviceMonthData(currentDevice, year, month);
}

function populateChartYearSelect() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  chartYearSelect.innerHTML = '';

  for (let year = currentYear; year >= currentYear - 2; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year + 543; // แสดงเป็น พ.ศ.
    chartYearSelect.appendChild(option);
  }

  chartMonthSelect.value = currentMonth;
  chartYearSelect.value = currentYear;
}

// ========== EDIT NAME ==========
function showEditModal() {
  newNameInput.value = currentDevice.device_name;
  editModal.classList.remove('hidden');
  newNameInput.focus();
  console.log('✏️ Edit name modal opened');
}

function hideEditModal() {
  editModal.classList.add('hidden');
  console.log('✏️ Edit name modal closed');
}

async function saveDeviceName() {
  const newName = newNameInput.value.trim();
  
  if (!newName) {
    alert('กรุณาใส่ชื่อเครื่อง');
    return;
  }
  
  if (newName === currentDevice.device_name) {
    hideEditModal();
    return;
  }
  
  try {
    showLoading();
    console.log(`💾 Saving new name: ${newName}`);
    
    const response = await API.updateDeviceName(currentDevice.device_id, newName);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    currentDevice.device_name = newName;
    deviceTitle.textContent = newName;
    hideEditModal();
    
    console.log('✅ Name updated successfully');
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.className = 'success-msg';
    successMsg.textContent = '✅ บันทึกชื่อเครื่องสำเร็จ';
    successMsg.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #d4fc79, #96e6a1);
      color: #22543d;
      padding: 1rem 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1001;
      animation: slideDown 0.3s ease-out;
    `;
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
      successMsg.remove();
    }, 3000);
    
  } catch (error) {
    console.error('❌ Save name failed:', error);
    showError('ไม่สามารถบันทึกชื่อได้: ' + error.message);
  } finally {
    hideLoading();
  }
}

// ========== EXPORT PDF ==========
function showExportModal() {
  exportModal.classList.remove('hidden');
  console.log('📄 Export modal opened');
}

function hideExportModal() {
  exportModal.classList.add('hidden');
  console.log('📄 Export modal closed');
}

function populateYearSelect() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  yearSelect.innerHTML = '';
  
  for (let year = currentYear; year >= currentYear - 2; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year + 543; // แสดงเป็น พ.ศ.
    yearSelect.appendChild(option);
  }
  
  monthSelect.value = currentMonth;
  yearSelect.value = currentYear;
}

async function generatePDF() {
  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  
  console.log(`📄 Generating PDF for ${year}-${month}`);
  
  hideExportModal();
  
  try {
    await pdfExporter.generateMonthlyPDF(currentDevice, year, month);
    console.log('✅ PDF generated successfully');
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    showError('ไม่สามารถสร้าง PDF ได้: ' + error.message);
  }
}

// ========== NOTIFICATION MODAL ==========
function showNotificationModal() {
  notificationModal.classList.remove('hidden');
  console.log('🔔 Notification modal opened');
}

function hideNotificationModal() {
  notificationModal.classList.add('hidden');
  console.log('🔔 Notification modal closed');
}

// ========== REFRESH ==========
function handleRefresh() {
  console.log('🔄 Refreshing...');
  refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    refreshBtn.style.transform = '';
  }, 300);
  
  if (deviceDetail.classList.contains('hidden')) {
    loadDevices();
  } else {
    loadDeviceData(currentDevice, 24);
  }
}

// ========== UI HELPERS ==========
function showLoading() {
  loading.classList.remove('hidden');
}

function hideLoading() {
  loading.classList.add('hidden');
}

function showError(message) {
  console.error('💥 Error:', message);
  errorText.textContent = message;
  errorMsg.classList.remove('hidden');
  hideLoading();
  
  setTimeout(() => {
    errorMsg.classList.add('hidden');
  }, 5000);
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== ERROR HANDLING ==========
window.addEventListener('error', (event) => {
  console.error('💥 Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Unhandled promise rejection:', event.reason);
});

// ========== ONLINE/OFFLINE DETECTION ==========
window.addEventListener('online', () => {
  console.log('📡 Back online');
  const onlineMsg = document.createElement('div');
  onlineMsg.className = 'success-msg';
  onlineMsg.textContent = '📡 เชื่อมต่ออินเทอร์เน็ตแล้ว';
  onlineMsg.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #d4fc79, #96e6a1);
    color: #22543d;
    padding: 1rem 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1001;
  `;
  document.body.appendChild(onlineMsg);
  
  setTimeout(() => {
    onlineMsg.remove();
  }, 3000);
  
  // Reload data
  if (deviceDetail.classList.contains('hidden')) {
    loadDevices();
  }
});

window.addEventListener('offline', () => {
  console.log('📡 Offline');
  showError('ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
});

// ========== CONSOLE LOG ==========
console.log(`
╔════════════════════════════════╗
║   🌡️  Fridge Monitor PWA      ║
║   Version: 1.0.0               ║
║   Status: Ready                ║
╚════════════════════════════════╝
`);
// ========== ANDROID SETTINGS ==========
function openAndroidSettings() {
  // Try to open Chrome settings for this site
  const settingsUrls = [
    'chrome://settings/content/siteDetails?site=' + encodeURIComponent(location.origin),
    'about:preferences#privacy',
    location.origin
  ];
  
  // Try opening in new tab
  try {
    window.open(settingsUrls[0], '_blank');
  } catch (error) {
    // Fallback: show alert with instructions
    alert(
      'Cannot open settings automatically.\n\n' +
      'Please follow these steps:\n' +
      '1. Tap ⋮ (3 dots) at top right\n' +
      '2. Tap Settings\n' +
      '3. Tap Site settings\n' +
      '4. Tap Notifications\n' +
      '5. Find saantie.github.io\n' +
      '6. Change to Allow'
    );
  }
}

// ========== DEVELOPER HELPERS ==========
window.resetOnboarding = function() {
  onboardingManager.reset();
  localStorage.clear();
  location.reload();
  console.log('🔄 Onboarding reset - page reloading...');
};

console.log('💡 Developer tips:');
console.log('  - Type resetOnboarding() to reset onboarding');
console.log('  - Type localStorage.clear() to clear all data');
