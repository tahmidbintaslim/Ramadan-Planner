import fs from "node:fs";
import path from "node:path";
import webPush from "web-push";

function upsertEnv(filePath, entries) {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();

  // Replace keys in place and keep every other line, so the comments copied
  // from .env.example survive.
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v !== "string" || v.trim().length === 0) continue;
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${k}=`)) {
        lines[i] = `${k}=${v}`;
        found = true;
      }
    }
    if (!found) lines.push(`${k}=${v}`);
  }

  fs.writeFileSync(filePath, lines.join("\n") + "\n");
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
