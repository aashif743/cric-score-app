// App version / update config for the mobile "Update available" prompt.
//
// Values are read from env vars (set on Render) with sensible defaults, so a new
// release only needs the env bumped — no code change/redeploy required. iOS and
// Android are tracked separately because they can be released/approved at
// different times.
//
//   IOS_LATEST_VERSION / ANDROID_LATEST_VERSION  – newest version live on each store
//   IOS_MIN_VERSION    / ANDROID_MIN_VERSION     – below this the update is FORCED
//   APP_RELEASE_NOTES                            – shown in the prompt ("What's New")
//   IOS_STORE_URL / ANDROID_STORE_URL            – override the store links if needed
const IOS_APP_ID = process.env.IOS_APP_ID || "6758245259";
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "com.criczone.mobile";

// GET /api/app/version — public; the app checks this on launch.
exports.getAppVersion = (req, res) => {
  res.json({
    success: true,
    data: {
      ios: {
        latestVersion: process.env.IOS_LATEST_VERSION || "1.0.5",
        minVersion: process.env.IOS_MIN_VERSION || "1.0.0",
        storeUrl:
          process.env.IOS_STORE_URL || `https://apps.apple.com/app/id${IOS_APP_ID}`,
      },
      android: {
        latestVersion: process.env.ANDROID_LATEST_VERSION || "1.0.5",
        minVersion: process.env.ANDROID_MIN_VERSION || "1.0.0",
        storeUrl:
          process.env.ANDROID_STORE_URL ||
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
      },
      releaseNotes:
        process.env.APP_RELEASE_NOTES ||
        "Various performance, stability, and bug fixes.",
    },
  });
};
