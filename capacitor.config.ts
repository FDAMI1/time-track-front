import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nfskills.app',
  appName: 'NF Skills App',
  webDir: 'dist',
  server: {
    url: "https://portal.nfskills.com/",
    cleartext: true
  },
};


export default config;
