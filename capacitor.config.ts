import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nfskills.barik',
  appName: 'Barik',
  webDir: 'dist'
  bundledWebRuntime: false,
  server: {
    url: 'http://192.168.0.109:3000', // replace with your IP
    cleartext: true
  }
};

export default config;
