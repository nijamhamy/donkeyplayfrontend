import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  AdMob,
  AdmobConsentStatus,
  AppOpenAdPluginEvents,
  BannerAdPluginEvents,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';

/* =====================================================================
   APP OPEN AD  (src/components/AppOpenAd.jsx)

   Headless component: it shows NO UI by itself. It loads and shows an
   AdMob "App Open" ad at the right moment. Uses your REAL ad unit only.

   USER-FRIENDLY RULES (all can be changed in the settings below):
   - Ad is loaded in the background while the splash screen is running.
   - After the splash: ad is shown only if it is already ready.
     If it is not ready in ~3 seconds, we skip it (user never waits).
   - No ad on the very first launch of the app.
   - Never shown while the user is playing (only on HOME / RESULTS).
   - Never shown while offline.
   - When the user comes back from background: only if they were away
     for 30+ seconds, and at least 4 minutes after the last app open ad.
   - Never shown on top of another ad (interstitial / rewarded / banner tap)
     or on top of the consent form.
   - An ad older than 4 hours is not used (Google rule), it is reloaded.
   ===================================================================== */

/* ========================= SETTINGS ========================= */

// Your REAL App Open ad unit (the only ad unit used in this file).
const AD_UNIT_ID = 'ca-app-pub-8553625771070050/1219475608';

// SAFETY FOR YOUR OWN PHONE
// The real ad unit above is used everywhere. This list only tells Google that
// YOUR phone is a test device, so YOUR phone gets safe test ads (you can tap
// them without any risk). All other users still get real ads.
// The ID below comes from your logcat ("setTestDeviceIds(... F943D3C4...)").
// It is harmless to leave it in the release build.
const MY_TEST_DEVICE_IDS = ['F943D3C43DF558FD39888FEDFF2C9F3C'];

const SHOW_ON_COLD_START = true; // show after splash when the app is opened
const SHOW_ON_RESUME = true; // show when the user comes back from background
const MIN_LAUNCHES_BEFORE_FIRST_AD = 2; // 2 = skip the very first launch
const COLD_START_MAX_WAIT_MS = 3000; // max wait for the ad after splash
const MIN_BACKGROUND_MS = 30 * 1000; // must be away this long to see an ad on return
const MIN_INTERVAL_BETWEEN_ADS_MS = 4 * 60 * 1000; // minimum gap between two app open ads
const AD_EXPIRY_MS = 4 * 60 * 60 * 1000; // Google: app open ads expire after 4 hours
const SAFE_SCENES = ['HOME', 'RESULTS']; // never show during PLAYING / MULTIPLAYER
const MAX_LOAD_RETRIES = 3;
const RETRY_DELAY_MS = 30 * 1000; // 30s, 60s, 90s

// true = print "[AppOpenAd] ..." messages in Logcat (search "AppOpenAd").
// Set to false before you publish.
const DEBUG = true;

const LAUNCH_COUNT_KEY = 'donkey_play_launch_count';
const LAST_SHOWN_KEY = 'donkey_play_app_open_last_shown';

/* ========================= HELPERS ========================= */

const log = (...args) => {
  if (DEBUG) console.log('[AppOpenAd]', ...args);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readNumber(key) {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    // ignore
  }
}

// Shared state (module level, so it survives re-renders and React StrictMode)
const ad = {
  setupPromise: null,
  consentInfo: null,
  consentFormOpen: false,
  loadPromise: null,
  loaded: false,
  loadedAt: 0,
  retries: 0,
  retryTimer: null,
  showing: false,
  showingSince: 0,
  otherAdOpenSince: 0,
  lastAdActivityAt: 0,
  lastShownAt: readNumber(LAST_SHOWN_KEY),
  backgroundedAt: 0,
  launchCount: 0,
  launchCounted: false,
  coldStartHandled: false,
};

function countLaunch() {
  if (ad.launchCounted) return;
  ad.launchCounted = true;
  try {
    const next = readNumber(LAUNCH_COUNT_KEY) + 1;
    localStorage.setItem(LAUNCH_COUNT_KEY, String(next));
    ad.launchCount = next;
  } catch (e) {
    // storage not available -> do not block ads forever
    ad.launchCount = MIN_LAUNCHES_BEFORE_FIRST_AD;
  }
}

function isAdFresh() {
  return ad.loaded && Date.now() - ad.loadedAt < AD_EXPIRY_MS;
}

/* ================= ADMOB SETUP + CONSENT ================= */

function setupAdMob() {
  if (!ad.setupPromise) {
    ad.setupPromise = (async () => {
      await AdMob.initialize({
        initializeForTesting: MY_TEST_DEVICE_IDS.length > 0,
        testingDevices: MY_TEST_DEVICE_IDS,
      });
      ad.consentInfo = await AdMob.requestConsentInfo();
      log('AdMob ready. consent:', JSON.stringify(ad.consentInfo));
    })().catch((e) => {
      console.warn('[AppOpenAd] AdMob setup failed:', e?.message || e);
      ad.setupPromise = null; // allow a new try later
    });
  }
  return ad.setupPromise;
}

// Works with new and old plugin versions
function consentAllowsAds(info) {
  if (!info) return false;
  if (typeof info.canRequestAds === 'boolean') return info.canRequestAds;
  return info.status !== AdmobConsentStatus.REQUIRED;
}

// Returns true when we are allowed to request ads (consent OK).
// The consent form (GDPR / UMP) is only shown when allowForm = true.
async function canRequestAds(allowForm) {
  await setupAdMob();
  if (!ad.consentInfo) return false;

  const info = ad.consentInfo;
  if (
    !consentAllowsAds(info) &&
    allowForm &&
    info.isConsentFormAvailable &&
    info.status === AdmobConsentStatus.REQUIRED
  ) {
    ad.consentFormOpen = true;
    try {
      ad.consentInfo = await AdMob.showConsentForm();
    } catch (e) {
      log('consent form error', e);
    } finally {
      ad.consentFormOpen = false;
      ad.lastAdActivityAt = Date.now();
    }
  }

  return consentAllowsAds(ad.consentInfo);
}

/* ====================== LOAD / SHOW ====================== */

function scheduleRetry() {
  if (ad.retries >= MAX_LOAD_RETRIES) return;
  ad.retries += 1;
  clearTimeout(ad.retryTimer);
  ad.retryTimer = setTimeout(() => {
    loadAd();
  }, RETRY_DELAY_MS * ad.retries);
}

async function doLoad(allowConsentForm) {
  try {
    if (!(await canRequestAds(allowConsentForm))) {
      log('cannot request ads yet (consent / setup)');
      return false;
    }
    log('loading app open ad...');
    await AdMob.loadAppOpen({ adId: AD_UNIT_ID });
    ad.loaded = true;
    ad.loadedAt = Date.now();
    ad.retries = 0;
    log('ad loaded');
    return true;
  } catch (e) {
    ad.loaded = false;
    console.warn('[AppOpenAd] load failed:', e?.message || JSON.stringify(e));
    scheduleRetry();
    return false;
  }
}

function loadAd({ allowConsentForm = false } = {}) {
  if (isAdFresh()) return Promise.resolve(true);
  if (ad.showing) return Promise.resolve(false);

  if (ad.loadPromise) {
    // A load is already running. If we are now allowed to show the consent
    // form (and it may have been skipped), try once more after it finishes.
    return allowConsentForm
      ? ad.loadPromise.then((ok) => ok || loadAd({ allowConsentForm: true }))
      : ad.loadPromise;
  }

  ad.loadPromise = doLoad(allowConsentForm).finally(() => {
    ad.loadPromise = null;
  });
  return ad.loadPromise;
}

function canShow(scene, isOffline) {
  const now = Date.now();

  // safety nets in case an ad event was missed
  if (ad.showing && now - ad.showingSince > 3 * 60 * 1000) ad.showing = false;
  if (ad.otherAdOpenSince && now - ad.otherAdOpenSince > 3 * 60 * 1000) ad.otherAdOpenSince = 0;

  let reason = '';
  if (ad.showing || ad.consentFormOpen || ad.otherAdOpenSince) reason = 'another ad / form is open';
  else if (isOffline) reason = 'offline';
  else if (!SAFE_SCENES.includes(scene)) reason = `scene is ${scene}`;
  else if (ad.launchCount < MIN_LAUNCHES_BEFORE_FIRST_AD) reason = `launch #${ad.launchCount} (first ad from launch #${MIN_LAUNCHES_BEFORE_FIRST_AD})`;
  else if (now - ad.lastShownAt < MIN_INTERVAL_BETWEEN_ADS_MS) reason = 'last app open ad was less than 4 minutes ago';
  else if (now - ad.lastAdActivityAt < 3000) reason = 'another ad just closed';

  if (reason) {
    log('not showing:', reason);
    return false;
  }
  return true;
}

async function showAd() {
  if (!isAdFresh()) return false;

  log('showing app open ad');
  ad.showing = true;
  ad.showingSince = Date.now();
  ad.loaded = false; // an app open ad can only be shown once

  try {
    await AdMob.showAppOpen();
    return true;
  } catch (e) {
    console.warn('[AppOpenAd] show failed:', e?.message || JSON.stringify(e));
    ad.showing = false;
    loadAd();
    return false;
  }
}

/* ======================== COMPONENT ======================== */

export default function AppOpenAd({ scene, isOffline }) {
  // always hold the newest props, so async callbacks never use old values
  const propsRef = useRef({ scene, isOffline });
  propsRef.current = { scene, isOffline };

  // 1) Register listeners (ad events + app foreground/background)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined; // AdMob works on device only

    countLaunch();
    log('component started. launch #', ad.launchCount);

    let cancelled = false;
    const handles = [];

    const listen = async (target, eventName, callback) => {
      try {
        const handle = await target.addListener(eventName, callback);
        if (cancelled) {
          handle.remove();
        } else {
          handles.push(handle);
        }
      } catch (e) {
        log('listener error', eventName, e);
      }
    };

    // --- App Open ad events
    listen(AdMob, AppOpenAdPluginEvents.Opened, () => {
      const now = Date.now();
      ad.showing = true;
      ad.showingSince = now;
      ad.lastShownAt = now;
      ad.lastAdActivityAt = now;
      writeNumber(LAST_SHOWN_KEY, now);
      log('app open ad opened');
    });

    listen(AdMob, AppOpenAdPluginEvents.Closed, () => {
      ad.showing = false;
      ad.lastAdActivityAt = Date.now();
      ad.backgroundedAt = 0;
      log('app open ad closed');
      loadAd(); // prepare the next one
    });

    listen(AdMob, AppOpenAdPluginEvents.FailedToShow, (error) => {
      log('app open ad failed to show', JSON.stringify(error));
      ad.showing = false;
      ad.loaded = false;
      loadAd();
    });

    // --- Other full-screen ads: never show app open on top of them
    const otherOpened = () => {
      ad.otherAdOpenSince = Date.now();
      ad.lastAdActivityAt = Date.now();
    };
    const otherClosed = () => {
      ad.otherAdOpenSince = 0;
      ad.lastAdActivityAt = Date.now();
      ad.backgroundedAt = 0;
    };
    listen(AdMob, InterstitialAdPluginEvents.Showed, otherOpened);
    listen(AdMob, InterstitialAdPluginEvents.Dismissed, otherClosed);
    listen(AdMob, RewardAdPluginEvents.Showed, otherOpened);
    listen(AdMob, RewardAdPluginEvents.Dismissed, otherClosed);
    listen(AdMob, BannerAdPluginEvents.Opened, otherOpened); // user tapped a banner
    listen(AdMob, BannerAdPluginEvents.Closed, otherClosed);

    // --- User leaves / returns to the app
    const onBackground = () => {
      if (ad.backgroundedAt) return;
      if (ad.showing || ad.otherAdOpenSince || ad.consentFormOpen) return;
      ad.backgroundedAt = Date.now();
      log('app went to background');
    };

    const onForeground = () => {
      const away = ad.backgroundedAt ? Date.now() - ad.backgroundedAt : 0;
      ad.backgroundedAt = 0;
      if (away) log('app came back. away (seconds):', Math.round(away / 1000));

      // keep one ad ready for next time
      if (!isAdFresh()) {
        ad.retries = 0;
        loadAd();
      }

      if (!SHOW_ON_RESUME || away < MIN_BACKGROUND_MS) return;

      const { scene: currentScene, isOffline: offline } = propsRef.current;
      if (isAdFresh() && canShow(currentScene, offline)) {
        showAd();
      } else if (!isAdFresh()) {
        log('not showing: ad is not ready yet');
      }
    };

    // Capacitor event
    listen(CapApp, 'appStateChange', ({ isActive }) => {
      if (isActive) onForeground();
      else onBackground();
    });

    // Backup: works even if some other code removes Capacitor App listeners
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBackground();
      else onForeground();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(ad.retryTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      handles.forEach((handle) => handle.remove());
    };
  }, []);

  // 2) Preload the ad in the background (during splash) and again when internet returns
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || isOffline) return;
    if (!isAdFresh()) {
      ad.retries = 0;
      loadAd();
    }
  }, [isOffline]);

  // 3) Splash finished -> show the ad (only if it is ready in time)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (scene === 'SPLASH' || ad.coldStartHandled) return;
    ad.coldStartHandled = true;
    if (!SHOW_ON_COLD_START) return;

    (async () => {
      log('splash finished, waiting for ad...');

      // wait for the ad, but never longer than COLD_START_MAX_WAIT_MS
      await Promise.race([loadAd({ allowConsentForm: true }), sleep(COLD_START_MAX_WAIT_MS)]);

      // small pause so the Home screen fade-in finishes first
      await sleep(350);

      const { scene: currentScene, isOffline: offline } = propsRef.current;
      if (isAdFresh() && canShow(currentScene, offline)) {
        showAd();
      } else if (!isAdFresh()) {
        log('not showing: ad was not ready in time');
      }
    })();
  }, [scene]);

  return null;
}