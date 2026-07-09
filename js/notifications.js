// ========== Push Notifications (Firebase Cloud Messaging) ==========
// Delivers alerts even when the app isn't open: a server-sent push wakes
// firebase-messaging-sw.js, which shows an OS notification (sound + vibrate
// come from the OS notification channel automatically). While the app tab
// IS open and focused, FCM instead delivers the message to onMessage() here,
// which has to show the notification and play a sound itself.

const FCM_TOKEN_STORAGE_KEY = 'fridgeMonitor_fcmToken';
const FCM_ENABLED_STORAGE_KEY = 'fridgeMonitor_notificationsEnabled';
const FCM_SW_SCOPE = './firebase-cloud-messaging-push-scope';

class NotificationManager {
  constructor() {
    this.messaging = null;
    this.swRegistration = null;
    this.currentToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY) || null;
  }

  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  async init() {
    if (!this.isSupported()) {
      console.warn('⚠️ Push notifications not supported in this browser');
      this.updateBadge();
      return false;
    }

    try {
      // Registered at a dedicated scope so it never competes with sw.js
      // (the app-shell cache worker) for controlling fetches.
      this.swRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
        scope: FCM_SW_SCOPE
      });
      this.messaging = firebase.messaging();
    } catch (error) {
      console.error('❌ Firebase Messaging init failed:', error);
      return false;
    }

    const wasEnabled = localStorage.getItem(FCM_ENABLED_STORAGE_KEY) === 'true';
    if (wasEnabled && Notification.permission === 'granted' && this.currentToken) {
      notificationToggle.checked = true;
    } else if (Notification.permission === 'denied') {
      localStorage.setItem(FCM_ENABLED_STORAGE_KEY, 'false');
    }

    this.updateBadge();
    return true;
  }

  updateBadge() {
    const enabled = localStorage.getItem(FCM_ENABLED_STORAGE_KEY) === 'true' && Notification.permission === 'granted';
    notificationBadge.classList.toggle('hidden', enabled);
  }

  async enable() {
    if (!this.isSupported()) {
      this.showStatus('error', 'เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับการแจ้งเตือนแบบ Push');
      return false;
    }

    if (this.isIOS() && !this.isStandalone()) {
      this.showStatus('info', 'บน iPhone/iPad ต้องเพิ่มแอพนี้ไปที่หน้าจอหลักก่อน (Add to Home Screen) จึงจะเปิดการแจ้งเตือนได้');
      return false;
    }

    if (!FCM_VAPID_KEY || FCM_VAPID_KEY === 'PASTE_YOUR_VAPID_KEY_HERE') {
      console.error('❌ FCM_VAPID_KEY is not configured in js/firebase-config.js');
      this.showStatus('error', 'ระบบแจ้งเตือนยังตั้งค่าไม่สมบูรณ์ กรุณาติดต่อผู้ดูแลระบบ');
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'denied') {
      this.showStatus('error', 'การแจ้งเตือนถูกปิดกั้นอยู่ กรุณาเปิดใช้งานในตั้งค่า Browser', true);
      return false;
    }

    if (permission !== 'granted') {
      return false;
    }

    try {
      const token = await this.messaging.getToken({
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: this.swRegistration
      });

      if (!token) {
        this.showStatus('error', 'ไม่สามารถขอรหัสการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง');
        return false;
      }

      const deviceName = (typeof currentDevice !== 'undefined' && currentDevice) ? currentDevice.device_name : '';
      const response = await API.saveFCMToken(token, deviceName);
      if (response.error) {
        throw new Error(response.error);
      }

      this.currentToken = token;
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(FCM_ENABLED_STORAGE_KEY, 'true');

      this.showStatus('success', '✅ เปิดการแจ้งเตือนสำเร็จ คุณจะได้รับแจ้งเตือนพร้อมเสียงแม้ไม่ได้เปิดแอพ');
      this.updateBadge();
      return true;
    } catch (error) {
      console.error('❌ Enable notifications failed:', error);
      this.showStatus('error', 'เกิดข้อผิดพลาด: ' + error.message);
      return false;
    }
  }

  async disable() {
    try {
      if (this.currentToken) {
        await API.removeFCMToken(this.currentToken).catch(err => console.warn('⚠️ Remove token on server failed:', err));
      }
      if (this.messaging) {
        await this.messaging.deleteToken().catch(() => {});
      }
    } finally {
      this.currentToken = null;
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      localStorage.setItem(FCM_ENABLED_STORAGE_KEY, 'false');
      this.showStatus('info', 'ปิดการแจ้งเตือนแล้ว');
      this.updateBadge();
    }
  }

  setupForegroundNotifications() {
    if (!this.messaging) return;

    this.messaging.onMessage(payload => {
      console.log('🔔 Foreground message received:', payload);

      const title = (payload.notification && payload.notification.title) || 'Fridge Monitor Alert';
      const body = (payload.notification && payload.notification.body) || 'พบอุณหภูมิผิดปกติ';
      const severity = payload.data && payload.data.severity;

      this.playAlertSound();

      if (this.swRegistration) {
        this.swRegistration.showNotification(title, {
          body,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'temperature-alert',
          requireInteraction: severity === 'critical',
          vibrate: severity === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
          silent: false
        });
      }
    });
  }

  // Foreground messages don't get an OS-level sound automatically (unlike a
  // background push notification), so synthesize a short alert beep.
  playAlertSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();

      const beep = (startTime, freq) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      };

      const resumeAndPlay = () => {
        const now = ctx.currentTime;
        beep(now, 880);
        beep(now + 0.35, 880);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(resumeAndPlay).catch(() => {});
      } else {
        resumeAndPlay();
      }
    } catch (error) {
      console.warn('⚠️ Cannot play alert sound:', error);
    }
  }

  showStatus(type, message, showAndroidSettingsLink = false) {
    notificationStatusText.innerHTML = escapeHtml(message) +
      (showAndroidSettingsLink ? '<br><button id="openSettingsBtn" class="btn-secondary" style="margin-top:0.75rem;">เปิดตั้งค่าการแจ้งเตือน</button>' : '');
    notificationStatus.className = `notification-status status-${type}`;
    notificationStatus.classList.remove('hidden');
  }
}

const notificationManager = new NotificationManager();
