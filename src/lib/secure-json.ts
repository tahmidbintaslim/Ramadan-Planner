import crypto from "node:crypto";

interface EncryptedJsonPayload {
  v: 1;
  alg: "A256GCM";
  iv: string;
  tag: string;
  data: string;
}

function parseKey(): Buffer {
  const raw = process.env.CALENDAR_TOKENS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("Missing CALENDAR_TOKENS_ENCRYPTION_KEY");
  }

  // Support 64-char hex or base64 encoded key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("CALENDAR_TOKENS_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return decoded;
}

function isEncryptedPayload(value: unknown): value is EncryptedJsonPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.v === 1 &&
    row.alg === "A256GCM" &&
    typeof row.iv === "string" &&
    typeof row.tag === "string" &&
    typeof row.data === "string"
  );
}

export function encryptJson(value: unknown): EncryptedJsonPayload {
  const key = parseKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptJson(value: unknown): unknown {
  if (!isEncryptedPayload(value)) {
    return value;
  }

  const key = parseKey();
  const iv = Buffer.from(value.iv, "base64");
  const tag = Buffer.from(value.tag, "base64");
  const encrypted = Buffer.from(value.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as unknown;
}
