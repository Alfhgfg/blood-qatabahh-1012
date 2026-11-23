import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeNavigationPluginInterface {
  exitApp(): Promise<void>;
}

const NativeNavigation = registerPlugin<NativeNavigationPluginInterface>('NativeNavigation');

export const nativeNavigationService = {
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async exitApp(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await NativeNavigation.exitApp();
    } catch (err) {
      console.warn('NativeNavigation.exitApp error:', err);
    }
  }
};
