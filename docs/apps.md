# Native apps

The native apps are thin shells around the deployed site, `https://ramadanplanner.tahmid.space`. There is no second
UI codebase: every web deploy updates the apps too. The web app is server-rendered (Clerk auth and API routes), so the
shells load it by URL. They do not bundle it.

| Shell | Platforms | Where | Config |
| --- | --- | --- | --- |
| Trusted Web Activity | Android | `android/` | `android/app/build.gradle` |
| Capacitor 8 | iOS | `ios/` | `capacitor.config.ts` |
| Tauri 2 | Windows, macOS, Linux | `src-tauri/` | `src-tauri/tauri.conf.json` |

`native/www/index.html` is the offline fallback page ("সংযোগ নেই / No connection", with a retry button). Capacitor
shows it when the site fails to load (`server.errorPath`). `native/assets/logo.png` is the source image for the
mobile icons and splash screens.

The iOS (Capacitor) webview may only navigate to the site, the Clerk hosts (`*.clerk.accounts.dev`,
`clerk.ramadanplanner.tahmid.space`) and `checkout.stripe.com`. Other links open in the system browser. The Tauri
window gives the remote site no IPC access and no permissions.

## Build

Run `npm ci` first. The web build (`npm run build`) does not use any of these folders. They are excluded from tsc,
eslint and the Vercel upload (`.vercelignore`).

### Android (any OS): Trusted Web Activity

The Android app is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity): it
opens `https://ramadanplanner.tahmid.space/today?app=android` full screen in the user's Chrome. Web push reminders,
Google sign-in and offline caching work as on the website, and Chrome's reminders show as the app's notifications
(`DelegationService`). `?app=android` makes the site hide donation links (store payment rules).

1. Install Android Studio (or the command-line SDK with platform 36 and a JDK 17+).
2. `cd android && ./gradlew assembleDebug` builds `app/build/outputs/apk/debug/app-debug.apk` for a phone.
3. Release: create an upload keystore once, outside the repo:
   `keytool -genkey -v -keystore ~/ramadan-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`.
   Write `android/keystore.properties` (gitignored) with `storeFile`, `storePassword`, `keyAlias` and
   `keyPassword`, then run `npm run android:bundle`. Upload `app/build/outputs/bundle/release/app-release.aab`.
4. `versionCode` must rise with every upload. A local build is 1 unless `ANDROID_VERSION_CODE` is set.
5. **Or let GitHub build it** (no Android Studio): add four repository secrets (Settings → Secrets and variables
   → Actions): `ANDROID_KEYSTORE_BASE64` (the output of `base64 -w0 ~/ramadan-upload.jks`, or on macOS
   `base64 -i ~/ramadan-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`) and
   `ANDROID_KEY_PASSWORD`. Then run Actions → **Android release** → Run workflow, or push a `v*` tag. Download the
   `ramadan-planner-aab` artifact and upload it to Play. The run number becomes the `versionCode`.
6. **Asset links** (once, after the first upload): copy the SHA-256 fingerprint of the *app signing key*
   (Play Console → Test and release → App integrity), plus your upload key's (`keytool -list -v -keystore
   ~/ramadan-upload.jks`), into the Vercel variable `ANDROID_CERT_SHA256`, comma separated, and redeploy.
   `/.well-known/assetlinks.json` then lists them. Without it Chrome shows its address bar inside the app.

### iOS (macOS only)

1. Install Xcode. Swift Package Manager handles the dependencies, so CocoaPods is not needed.
2. Run `npx cap sync ios && npx cap open ios`. In Xcode, pick your team under Signing & Capabilities, then build,
   or archive for App Store Connect.

### Desktop (build on each OS for that OS)

1. Install Rust (`rustup`) and the Tauri system dependencies for your OS: https://v2.tauri.app/start/prerequisites/.
   On Linux that means `webkit2gtk-4.1`, `gtk3`, `libsoup3` and friends. On Windows it means WebView2, which
   Windows 11 already has.
2. `npm run tauri:dev` opens the window. `npm run tauri:build` writes installers to
   `src-tauri/target/release/bundle/` (`.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS, `.deb`/`.rpm`/`.AppImage` on
   Linux).

### Regenerate icons

The icons come from the PWA icons in `public/icons/`.

- iOS (Android keeps its committed `android/app/src/main/res` icons): `npx @capacitor/assets@4 generate --ios --assetPath native/assets --iconBackgroundColor '#0E7C6B' --iconBackgroundColorDark '#0E7C6B' --splashBackgroundColor '#0E7C6B' --splashBackgroundColorDark '#0E7C6B' --logoSplashScale 0.4`
  (run on demand and not installed, because it pulls in packages with known npm audit warnings).
- Desktop: `npx tauri icon public/icons/icon-512.png`, then delete `src-tauri/icons/android` and `src-tauri/icons/ios`.

## What the founder must provide

- An **Apple Developer account** ($99/year) to sign and ship to the App Store. Builds need a Mac with Xcode.
- A **Google Play Console account** ($25 one-time) and an **upload keystore**. Keep the keystore and its passwords out
  of the repo (`*.jks`, `*.keystore` and `keystore.properties` are gitignored).
- **Desktop code signing**, optional but avoids OS warnings: an Apple Developer ID certificate plus notarization for
  macOS, and a code-signing certificate for Windows.
- **Clerk**: on Android (real Chrome) every sign-in method works. On iOS, email and password sign-in works in the
  webview as is; Google OAuth blocks embedded webviews
  (`disallowed_useragent`). If social sign-in is needed in the apps, enable Clerk's native/mobile flow and add the app's
  redirect URL (for example `space.tahmid.ramadanplanner://callback`) under Clerk's allowed redirect URLs. That also
  needs a deep link, which is listed below.
- **Store review**: Apple can reject apps that only wrap a website (guideline 4.2). Both stores require in-app
  purchase for tips to a developer, so the apps hide every donation link (`?app=android` and the iOS user agent mark
  the app; see `src/routes/__root.tsx`). Store listing text and answers: `docs/store-listing.md`.

## Known limits

- The apps load the live site. On Android, Chrome's service worker serves cached pages offline, as on the website.
  On iOS, the offline fallback page shows when the site cannot be reached.
- The desktop window shows the system webview's own error page when offline. It has no custom fallback yet.
- Web push works on Android (Chrome, delegated to the app). iOS WKWebView does not support the Push API, so
  reminders in the iOS app need native push (below).

## Follow-ups (not built)

- iOS native push through `@capacitor/push-notifications` (APNs), wired into the reminder dispatch.
- Deep links and universal links (`assetlinks.json`, `apple-app-site-association`), also needed for native OAuth.
- Home-screen widgets (prayer and iftar times).
- Native adhan audio and alarms.
- In-app purchases, if store rules require them for donations.
- An offline fallback for the desktop window.
