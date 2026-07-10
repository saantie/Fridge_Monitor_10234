// ========== Out-of-range event detection (shared) ==========
// "Standard" here is TEMP_STANDARD from charts.js (chiller +2~+8C, freezer -25~-15C),
// loaded before this script - shared as the single source of truth for what counts as an event.
// Used by the PDF export, the dashboard summary banner, and the events history page,
// so all three surfaces agree on exactly what an "abnormal event" is.

const THAI_MONTH_NAMES = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

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

// Longest event by duration; ties broken by earliest start, independent of
// whatever order the caller's events array happens to be sorted in for display -
// otherwise the dashboard banner and the events page could each show a
// different "longest" event on a tie.
function findLongestEvent(events) {
  return events.reduce((best, ev) => {
    if (!best) return ev;
    if (ev.durationMs > best.durationMs) return ev;
    if (ev.durationMs === best.durationMs && new Date(ev.start) < new Date(best.start)) return ev;
    return best;
  }, null);
}

// ========== Cross-device aggregation for a given month ==========
// Fetches each device's monthly data, runs detection per device, and tags each
// event with the device it came from. Shared by the dashboard summary banner
// and the events history page so both stay in sync with one algorithm.
async function fetchMonthEventsForDevices(devices, year, month) {
  const perDevice = await Promise.all(devices.map(async device => {
    try {
      const response = await API.getMonthlyData(device.device_name, year, month);
      if (response.error || !response.data || response.data.length === 0) return [];

      const sorted = [...response.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return detectOutOfRangeEvents(sorted).map(ev => ({ ...ev, deviceName: device.device_name }));
    } catch (error) {
      console.error(`❌ Load monthly data failed for ${device.device_name}:`, error);
      return [];
    }
  }));

  return perDevice.flat();
}
