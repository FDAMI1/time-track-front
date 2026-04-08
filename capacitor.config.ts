import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nfskills.barik',
  appName: 'Barik',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://portal.nfskills.com', // replace with your IP
    cleartext: true
  }
};

export default config;
