// Single source of truth for the app version - read by both app.js (shows it
// in the header) and sw.js (via importScripts, folds it into CACHE_NAME).
// Bump this on every deploy that ships a user-visible change, so it's easy
// to confirm in the header that the service worker actually picked up the
// latest version instead of serving something stale.
const APP_VERSION = 'v1.2.0';
