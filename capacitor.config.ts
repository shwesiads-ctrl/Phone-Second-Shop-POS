import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.myominaung.phonesecondshoppos.mobile",
  loggingBehavior: "none",
  appName: "Phone Second Shop POS",
  webDir: "dist-android",
  android: { allowMixedContent: false },
  server: { androidScheme: "https" },
};
export default config;
