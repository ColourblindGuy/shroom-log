export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function isInWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("wv")) return true;
  if (ua.includes("fbav") || ua.includes("fban")) return true;
  if (ua.includes("instagram")) return true;
  if (ua.includes("messenger")) return true;
  return false;
}

export function getNotificationDiagnostic() {
  if ("Notification" in window) return { supported: true };

  if (isInWebView()) {
    return {
      supported: false,
      label: "📱 Open in your device browser",
      help: "This page is opened inside another app, which blocks notifications. Tap the menu (⋯) and select 'Open in Chrome' or 'Open in Safari'.",
    };
  }

  if (isIOS()) {
    if (isInStandaloneMode()) {
      return {
        supported: false,
        label: "⚠️ Requires iOS 16.4+",
        help: "Web notifications on iOS require iOS 16.4 or later. Try updating your device, then delete and re-add this app to your Home Screen.",
      };
    }
    return {
      supported: false,
      label: "📱 Add to Home Screen first",
      help: "On iOS, notifications only work after adding this app to your Home Screen. Tap Share → Add to Home Screen, then open the app and enable notifications.",
    };
  }

  return {
    supported: false,
    label: "⚠️ Not supported in this browser",
    help: "Notifications need a modern browser like Chrome or Safari over HTTPS. If you're using an in-app browser, open this page directly in your device browser instead.",
  };
}
