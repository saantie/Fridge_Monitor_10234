/**
 * ========================================
 * Events History Page
 * รายการเหตุการณ์อุณหภูมิผิดปกติ (รายเดือน)
 * ========================================
 */

const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const errorText = document.getElementById('errorText');
const eventsPage = document.getElementById('eventsPage');

const eventsMonthSelect = document.getElementById('eventsMonthSelect');
const eventsYearSelect = document.getElementById('eventsYearSelect');
const viewEventsBtn = document.getElementById('viewEventsBtn');
const eventsMonthSummary = document.getElementById('eventsMonthSummary');
const eventsListContainer = document.getElementById('eventsListContainer');

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const year = parseInt(params.get('year')) || defaultYear;
  const month = parseInt(params.get('month')) || defaultMonth;

  populateEventsYearSelect(year);
  eventsMonthSelect.value = month;

  viewEventsBtn.addEventListener('click', () => {
    const y = parseInt(eventsYearSelect.value);
    const m = parseInt(eventsMonthSelect.value);
    loadAndRenderEvents(y, m);
  });

  loadAndRenderEvents(year, month);
});

function populateEventsYearSelect(selectedYear) {
  const currentYear = new Date().getFullYear();

  eventsYearSelect.innerHTML = '';
  for (let year = currentYear; year >= currentYear - 2; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year + 543; // แสดงเป็น พ.ศ.
    eventsYearSelect.appendChild(option);
  }

  eventsYearSelect.value = selectedYear;
}

async function loadAndRenderEvents(year, month) {
  try {
    showLoading();
    eventsPage.classList.add('hidden');
    hideError();

    const statusResponse = await API.getLatestStatus();
    if (statusResponse.error) throw new Error(statusResponse.error);

    const devices = statusResponse.devices || [];
    const events = await fetchMonthEventsForDevices(devices, year, month);
    events.sort((a, b) => new Date(b.start) - new Date(a.start));

    renderMonthSummary(events, year, month);
    renderEventsList(events);

    history.replaceState(null, '', `?year=${year}&month=${month}`);
    eventsPage.classList.remove('hidden');
  } catch (error) {
    console.error('❌ Load events failed:', error);
    showError('ไม่สามารถโหลดข้อมูลเหตุการณ์ได้: ' + error.message);
  } finally {
    hideLoading();
  }
}

function renderMonthSummary(events, year, month) {
  const monthLabel = `${THAI_MONTH_NAMES[month - 1]} ${year + 543}`;
  const chillerEvents = events.filter(e => e.type === 'chiller');
  const freezerEvents = events.filter(e => e.type === 'freezer');
  const chillerTotalMs = chillerEvents.reduce((sum, e) => sum + e.durationMs, 0);
  const freezerTotalMs = freezerEvents.reduce((sum, e) => sum + e.durationMs, 0);

  let longestHtml = '';
  if (events.length > 0) {
    const longest = findLongestEvent(events);
    const typeLabel = longest.type === 'chiller' ? 'ช่องธรรมดา' : 'ช่องแช่แข็ง';
    longestHtml = `
      <div class="events-longest-note">
        ⏱ ครั้งที่นานที่สุด: <strong>${escapeHtml(longest.deviceName)}</strong> · ${typeLabel} ·
        เริ่ม ${formatDateTimeShort(longest.start)} น. (นาน ${formatDuration(longest.durationMs)})
      </div>
    `;
  }

  const formatTotal = ms => ms === 0 ? '0 นาที' : formatDuration(ms);

  eventsMonthSummary.innerHTML = `
    <h2 class="events-month-title">${monthLabel}</h2>
    <div class="events-stats-row">
      <div class="events-stat-card total">
        <div class="events-stat-value">${events.length}</div>
        <div class="events-stat-label">เหตุการณ์ทั้งหมด</div>
      </div>
      <div class="events-stat-card chiller">
        <div class="events-stat-value">${chillerEvents.length}</div>
        <div class="events-stat-label">ช่องธรรมดา (รวม ${formatTotal(chillerTotalMs)})</div>
      </div>
      <div class="events-stat-card freezer">
        <div class="events-stat-value">${freezerEvents.length}</div>
        <div class="events-stat-label">ช่องแช่แข็ง (รวม ${formatTotal(freezerTotalMs)})</div>
      </div>
    </div>
    ${longestHtml}
  `;
}

function renderEventsList(events) {
  if (events.length === 0) {
    eventsListContainer.innerHTML = `
      <div class="events-empty-state">
        <p style="font-size: 2.5rem;">✅</p>
        <p style="font-size: 1.1rem; margin-top: 0.75rem;">ไม่พบเหตุการณ์อุณหภูมิผิดปกติในเดือนนี้</p>
      </div>
    `;
    return;
  }

  eventsListContainer.innerHTML = events.map(ev => {
    const typeLabel = ev.type === 'chiller' ? 'ช่องธรรมดา' : 'ช่องแช่แข็ง';
    const typeIcon = ev.type === 'chiller' ? '🧊' : '❄️';
    return `
      <div class="event-item ${ev.type}">
        <div class="event-item-type">${typeIcon} ${typeLabel}</div>
        <div class="event-item-device">${escapeHtml(ev.deviceName)}</div>
        <div class="event-item-time">${formatDateTimeShort(ev.start)} → ${formatDateTimeShort(ev.end)} น.</div>
        <div class="event-item-range">${ev.minVal.toFixed(1)}°C ~ ${ev.maxVal.toFixed(1)}°C</div>
        <div class="event-item-duration">${formatDuration(ev.durationMs)}</div>
      </div>
    `;
  }).join('');
}

// ========== UI HELPERS ==========
function showLoading() {
  loading.classList.remove('hidden');
}

function hideLoading() {
  loading.classList.add('hidden');
}

function showError(message) {
  errorText.textContent = message;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
