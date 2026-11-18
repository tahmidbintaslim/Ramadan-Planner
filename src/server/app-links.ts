// Digital Asset Links for the Android app (Trusted Web Activity): Chrome opens the site full screen, without the
// address bar, only when https://<host>/.well-known/assetlinks.json lists the app's signing key. The SHA-256
// fingerprints come from Play Console (Setup → App signing): set ANDROID_CERT_SHA256 in Vercel to them, comma
// separated (the Play App Signing key, plus the upload key to test a locally signed build). Public, not secret.

const PACKAGE_NAME = "space.tahmid.ramadanplanner";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** The assetlinks.json body; an empty list when no valid fingerprint is configured. */
export function assetLinks(raw: string | undefined): unknown[] {
  const fingerprints = (raw ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
