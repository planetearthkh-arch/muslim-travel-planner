/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planetearthkids.muslimtravelplanner',
  appName: 'SafarOne',
  webDir: 'dist-native',
  android: {
    allowMixedContent: false,
  },
  ios: {
    scheme: 'SafarOne',
    contentInset: 'automatic',
  },
  plugins: {
    LocalNotifications: {
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
};

export default config;
