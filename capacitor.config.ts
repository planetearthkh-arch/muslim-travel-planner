/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planetearthkids.muslimtravelplanner',
  appName: 'SafarMate',
  webDir: 'dist-native',
  android: {
    allowMixedContent: false,
  },
  ios: {
    scheme: 'SafarMate',
    contentInset: 'automatic',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    LocalNotifications: {
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
};

export default config;
