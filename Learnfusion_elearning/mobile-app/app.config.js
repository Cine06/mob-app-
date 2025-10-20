import "dotenv/config";

export default ({ config }) => ({
  ...config,
  name: "LearnFusion",
  slug: "LearnFusion",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/logo.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: false,

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.learnfusion.LearnFusion",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#1E5631",
    },
    package: "com.learnfusion.LearnFusion",
  },

  web: {
    bundler: "metro",
    favicon: "./assets/logo.png",
  },

  // Platforms supported
  platforms: ["android", "ios", "web"],

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/logo.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    "expo-font",
    "expo-web-browser",
    "expo-secure-store",
  ],

  experiments: {
    typedRoutes: true,
  },

  // Bare workflow requires a static runtime version for EAS Update.
  runtimeVersion: "1.0.0",

  updates: {
    // This tells Expo where to get your OTA updates
    url: "https://u.expo.dev/6779663d-c717-420a-b54d-38916a16b7a1",
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },

  extra: {
    eas: {
      projectId: "6779663d-c717-420a-b54d-38916a16b7a1",
      // 👇 Channel is important for OTA updates
      channel: process.env.EAS_CHANNEL || "production",
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    COHERE_API_KEY: process.env.COHERE_API_KEY,
    JDOODLE_CLIENT_ID: process.env.JDOODLE_CLIENT_ID,
    JDOODLE_CLIENT_SECRET: process.env.JDOODLE_CLIENT_SECRET,
    JDOODLE_RUN_URL: process.env.JDOODLE_RUN_URL,
    API_URL: process.env.API_URL,
    PORT: process.env.PORT,
  },

  owner: "learnfusion",
});
