import fs from "node:fs";
import path from "node:path";
import webPush from "web-push";

function upsertEnv(filePath, entries) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  const lines = content.split(/\r?\n/);
  const map = new Map();

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const val = line.slice(idx + 1);
    map.set(key, val);
  }

  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === "string" && v.trim().length > 0) {
      map.set(k, v);
    }
  }

  const out = [];
  for (const [k, v] of map) {
    out.push(`${k}=${v}`);
  }

  fs.writeFileSync(filePath, out.join("\n") + "\n");
}

function readArg(name) {
  const arg = process.argv.find((part) => part.startsWith(`${name}=`));
  if (!arg) return "";
  return arg.slice(name.length + 1).trim();
}

function main() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const vapidKeys = webPush.generateVAPIDKeys();

  const subjectFromArg = readArg("--subject");
  const subjectFromEnv = (process.env.VAPID_SUBJECT ?? "").trim();
  const subject = subjectFromArg || subjectFromEnv;

  const entries = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapidKeys.publicKey,
    VAPID_PRIVATE_KEY: vapidKeys.privateKey,
    ...(subject ? { VAPID_SUBJECT: subject } : {}),
  };

  upsertEnv(envPath, entries);

  if (!subject) {
    console.warn(
      "Generated VAPID keys, but VAPID_SUBJECT is not set. Set it in .env.local (e.g. mailto:you@example.com).",
    );
  }

  console.log(`Wrote VAPID config to ${envPath}`);
}

main();
