import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.myominaung.phonesecondshoppos.mobile",
  loggingBehavior: "none",
  appName: "Fixer Tools",
  webDir: "dist-android",
  android: { allowMixedContent: false },
  server: { androidScheme: "https" },
};
export default config;
