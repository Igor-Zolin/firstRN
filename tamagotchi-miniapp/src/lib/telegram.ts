type TelegramThemeParams = {
  bg_color?: string;
  secondary_bg_color?: string;
  bottom_bar_bg_color?: string;
};

type TelegramBackButton = {
  show: () => TelegramBackButton;
  hide: () => TelegramBackButton;
  onClick: (callback: () => void) => TelegramBackButton;
  offClick: (callback: () => void) => TelegramBackButton;
};

type TelegramWebApp = {
  initData: string;
  colorScheme?: 'light' | 'dark';
  platform?: string;
  version?: string;
  themeParams?: TelegramThemeParams;
  BackButton?: TelegramBackButton;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function getTelegramInitData() {
  return getTelegramWebApp()?.initData?.trim() ?? '';
}

export function initTelegramMiniApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  try {
    const backgroundColor = webApp.themeParams?.bg_color || '#0A0A0F';
    const bottomBarColor =
      webApp.themeParams?.bottom_bar_bg_color ||
      webApp.themeParams?.secondary_bg_color ||
      backgroundColor;

    webApp.setHeaderColor?.(backgroundColor);
    webApp.setBackgroundColor?.(backgroundColor);
    webApp.setBottomBarColor?.(bottomBarColor);
    webApp.expand();
    webApp.ready();
  } catch {
    // The regular browser fallback must remain usable.
  }

  return {
    platform: webApp.platform || 'unknown',
    colorScheme: webApp.colorScheme || 'dark',
    version: webApp.version || 'unknown',
  };
}

export function subscribeTelegramBackButton(
  visible: boolean,
  callback: () => void
) {
  const backButton = getTelegramWebApp()?.BackButton;
  if (!backButton) return () => undefined;

  if (visible) {
    backButton.onClick(callback).show();
  } else {
    backButton.hide();
  }

  return () => {
    backButton.offClick(callback);
  };
}
