import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nfskills.app',
  appName: 'NF Skills App',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
