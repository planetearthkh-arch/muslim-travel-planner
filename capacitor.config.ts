import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planetearthkids.muslimtravelplanner',
  appName: 'Muslim Travel Planner',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
