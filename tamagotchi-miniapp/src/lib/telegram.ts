declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        colorScheme?: 'light' | 'dark';
        platform?: string;
        version?: string;
      };
    };
  }
}

export function initTelegramMiniApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return null;

  try {
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.('#0A0A0F');
    webApp.setBackgroundColor?.('#0A0A0F');
  } catch {
    // Non-blocking: app must still run in regular browser.
  }

  return {
    platform: webApp.platform || 'unknown',
    colorScheme: webApp.colorScheme || 'dark',
    version: webApp.version || 'unknown',
  };
}
