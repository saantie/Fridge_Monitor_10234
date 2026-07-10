// ========== Firebase Configuration ==========
// Same project as firebase-messaging-sw.js - keep both in sync.
const firebaseConfig = {
  apiKey: "AIzaSyBqQcDngmgSj1KbZQQ9j9pZiMmPs7ydue0",
  authDomain: "notify-fridge-monitor-pwa.firebaseapp.com",
  projectId: "notify-fridge-monitor-pwa",
  storageBucket: "notify-fridge-monitor-pwa",
  messagingSenderId: "623427160222",
  appId: "1:623427160222:web:780e2011212969f6b5d38f"
};

// Web Push certificate key (Firebase Console > Project Settings > Cloud
// Messaging > Web configuration > Web Push certificates > key pair).
// messaging.getToken() cannot get a token without this - notifications
// stay disabled until a real key replaces this placeholder.
const FCM_VAPID_KEY = 'BHfDSQy07M7YUGNP5SvoDOumd62_1ZFO3nXvkBIEUG9DO495FT7R5YXLId9BDUMhm-Jhv-Iu4boEAmwLux23eWY';

firebase.initializeApp(firebaseConfig);
