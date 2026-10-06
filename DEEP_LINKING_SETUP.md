# Tournament sharing + deep links — setup & handoff

Shareable tournament links: `https://cric-zone.com/tournament/<shareId>`
Goal: tap link → **open the app** to that tournament if installed, else **open the store**.

## ✅ Already done in code
- **Share button** (TournamentDetail) generates the link and shares it natively.
- **app.json**: `scheme: "criczone"`, iOS `associatedDomains` (`applinks:cric-zone.com`), Android `intentFilters` (autoVerify, `/tournament/*`).
- **In-app routing**: NavigationContainer `linking` config maps `tournament/:shareId` → new `TournamentLinkScreen`, which resolves the share code via the public API and opens the live schedule.
- **Domain files**: `frontend/public/.well-known/apple-app-site-association` and `assetlinks.json`.

## 🔧 You must do these (need your store/domain specifics)

### 1. Android signing fingerprint (assetlinks.json)
- Play Console → your app → **Setup → App signing** → copy the **SHA-256 certificate fingerprint**.
- Paste it into `frontend/public/.well-known/assetlinks.json` replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` (format: `AA:BB:CC:…`).

### 2. Deploy the web `.well-known` files to cric-zone.com
After `npm run build` + upload, verify both are reachable **at the domain root**:
- `https://cric-zone.com/.well-known/apple-app-site-association` — must return **HTTP 200**, `Content-Type: application/json`, **no redirect**, no `.json` extension.
- `https://cric-zone.com/.well-known/assetlinks.json` — HTTP 200, application/json.
(On Hostinger you may need an `.htaccess` rule to force the AASA content-type and stop SPA rewrites from catching `/.well-known/*`.)

### 3. Native capability (the prebuilt iOS/Android projects don't read app.json automatically)
- **iOS (Xcode):** select the **CricZone** target → **Signing & Capabilities** → **+ Capability → Associated Domains** → add `applinks:cric-zone.com`. Re-archive.
- **Android:** if you build the existing `android/` project directly, add the intent-filter from `app.json` to `AndroidManifest.xml`; if you build via EAS/`expo prebuild`, it's applied automatically.
- Apple Team ID in the AASA is `U6ZHLMGQ3J` — confirm it matches your signing team.

### 4. Store fallback URLs (for the "not installed" case)
Fill real URLs in `frontend/src/pages/LandingPage.jsx` (currently `"#"`):
- Play: `https://play.google.com/store/apps/details?id=com.criczone.mobile`
- App Store: `https://apps.apple.com/app/id<YOUR_NUMERIC_APP_ID>` — paste your App Store numeric ID.
Optionally add a "Get the app" banner on `PublicTournament.jsx` so browser visitors without the app are nudged to install.

## 🧪 Testing
- iOS: after deploying AASA + adding the capability + installing a build, open Notes, paste the link, long-press → it should offer "Open in CricZone".
- Android: `adb shell pm verify-app-links --re-verify com.criczone.mobile` then tap a link; `adb shell pm get-app-links com.criczone.mobile` should show `verified`.
- Both validate with Apple's AASA validator / Google's Statement List generator.
