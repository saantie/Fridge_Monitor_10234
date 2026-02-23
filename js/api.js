// ใส่ Google Apps Script URL ของคุณที่นี่
const API_URL = 'https://script.google.com/macros/s/AKfycbzJZMv7DQHHx2WHDRFmwVfUdayL8LH8i2N5YW76s-vcRMq86k1k1CqXjZWsWgBVYx6P9Q/exec';

class API {
  static async getDevices() {
    const url = `${API_URL}?action=get_devices`;
    const response = await fetch(url);
    return await response.json();
  }

  static async getLatestStatus() {
    const url = `${API_URL}?action=get_latest_status`;
    const response = await fetch(url);
    return await response.json();
  }

  static async getDeviceData(deviceName, hours = 24) {
    const url = `${API_URL}?action=get_data&device_name=${encodeURIComponent(deviceName)}&hours=${hours}`;
    const response = await fetch(url);
    return await response.json();
  }

  static async getMonthlyData(deviceName, year, month) {
    const url = `${API_URL}?action=get_monthly_data&device_name=${encodeURIComponent(deviceName)}&year=${year}&month=${month}`;
    const response = await fetch(url);
    return await response.json();
  }

  static async updateDeviceName(deviceId, newName) {
    const url = `${API_URL}?action=update_device_name&device_id=${encodeURIComponent(deviceId)}&new_name=${encodeURIComponent(newName)}`;
    const response = await fetch(url);
    return await response.json();
  }

  static async saveFCMToken(token, deviceName) {
    const url = `${API_URL}?action=save_fcm_token&token=${encodeURIComponent(token)}&device_name=${encodeURIComponent(deviceName)}`;
    const response = await fetch(url);
    return await response.json();
  }

  static async removeFCMToken(token) {
    const url = `${API_URL}?action=remove_fcm_token&token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    return await response.json();
  }
}
