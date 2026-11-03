import { createHash } from "node:crypto";

// Existing users' data is keyed on this UUID: never change the algorithm (pinned in uuid.test.ts).
export function clerkIdToUuid(clerkId: string): string {
  const hash = createHash("sha256").update(`ramadan-planner:${clerkId}`).digest("hex");
  const bytes = hash.slice(0, 32).split("");

  bytes[12] = "5";
  const variant = Number.parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);

  const base = bytes.join("");
  return `${base.slice(0, 8)}-${base.slice(8, 12)}-${base.slice(12, 16)}-${base.slice(16, 20)}-${base.slice(20, 32)}`;
}
