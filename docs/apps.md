# Native apps

The native apps are thin shells around the deployed site, `https://ramadanplanner.tahmid.space`. There is no second
UI codebase: every web deploy updates the apps too. The web app is server-rendered (Clerk auth and API routes), so the
shells load it by URL. They do not bundle it.

| Shell | Platforms | Where | Config |
| --- | --- | --- | --- |
| Capacitor 8 | Android, iOS | `android/`, `ios/` | `capacitor.config.ts` |
| Tauri 2 | Windows, macOS, Linux | `src-tauri/` | `src-tauri/tauri.conf.json` |

`native/www/index.html` is the offline fallback page ("সংযোগ নেই / No connection", with a retry button). Capacitor
shows it when the site fails to load (`server.errorPath`). `native/assets/logo.png` is the source image for the
mobile icons and splash screens.

The Capacitor webview may only navigate to the site, the Clerk hosts (`*.clerk.accounts.dev`,
`clerk.ramadanplanner.tahmid.space`) and `checkout.stripe.com`. Other links open in the system browser. The Tauri
window gives the remote site no IPC access and no permissions.

## Build

Run `npm ci` first. The web build (`npm run build`) does not use any of these folders. They are excluded from tsc,
eslint and the Vercel upload (`.vercelignore`).

### Android (any OS)

1. Install Android Studio. It brings the Android SDK and a JDK (21 or later).
2. Run `npm run cap:android`. It syncs the config and opens the project in Android Studio. Run or build from there.
3. Or use the command line: `npx cap sync android`, then `cd android && ./gradlew assembleDebug`. The debug APK is in
   `android/app/build/outputs/apk/debug/`.
4. Release: create an upload keystore (outside the repo, never committed), add a signing config, then run
   `./gradlew bundleRelease` and upload the `.aab` to Google Play.

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

- Mobile: `npx @capacitor/assets@4 generate --android --ios --assetPath native/assets --iconBackgroundColor '#0E7C6B' --iconBackgroundColorDark '#0E7C6B' --splashBackgroundColor '#0E7C6B' --splashBackgroundColorDark '#0E7C6B' --logoSplashScale 0.4`
  (run on demand and not installed, because it pulls in packages with known npm audit warnings).
- Desktop: `npx tauri icon public/icons/icon-512.png`, then delete `src-tauri/icons/android` and `src-tauri/icons/ios`.

## What the founder must provide

- An **Apple Developer account** ($99/year) to sign and ship to the App Store. Builds need a Mac with Xcode.
- A **Google Play Console account** ($25 one-time) and an **upload keystore**. Keep the keystore and its passwords out
  of the repo (`*.jks`, `*.keystore` and `keystore.properties` are gitignored).
- **Desktop code signing**, optional but avoids OS warnings: an Apple Developer ID certificate plus notarization for
  macOS, and a code-signing certificate for Windows.
- **Clerk**: email and password sign-in works in the webview as is. Google OAuth blocks embedded webviews
  (`disallowed_useragent`). If social sign-in is needed in the apps, enable Clerk's native/mobile flow and add the app's
  redirect URL (for example `space.tahmid.ramadanplanner://callback`) under Clerk's allowed redirect URLs. That also
  needs a deep link, which is listed below.
- **Store review**: Apple can reject apps that only wrap a website (guideline 4.2), and both stores restrict
  non-store payments for digital goods. Check how donations and Stripe Checkout fit their rules before submitting.

## Known limits

- The apps need a network connection, because they load the live site. When the site cannot be reached, Android and
  iOS show the offline fallback page. The PWA service worker may also serve cached pages.
- The desktop window shows the system webview's own error page when offline. It has no custom fallback yet.
- Web push depends on the platform webview. Android WebView and iOS WKWebView do not support the Push API, so
  reminders in the mobile apps need native push (below).

## Follow-ups (not built)

- Native push through `@capacitor/push-notifications` (FCM/APNs), wired into the reminder dispatch.
- Deep links and universal links (`assetlinks.json`, `apple-app-site-association`), also needed for native OAuth.
- Home-screen widgets (prayer and iftar times).
- Native adhan audio and alarms.
- In-app purchases, if store rules require them for donations.
- An offline fallback for the desktop window.
