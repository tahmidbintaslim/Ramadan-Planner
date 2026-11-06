import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";

// The founder chose the spelling রমজান for the month and the brand. The old spelling is built from code points so
// this file never matches itself.
const OLD_SPELLING = "রমযান";
const SRC = path.resolve(import.meta.dirname, "..");

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });
}

describe("Bengali spelling of Ramadan", () => {
  it("the brand is রমজান প্ল্যানার", () => {
    expect(bn.common.appName).toBe("রমজান প্ল্যানার");
  });

  it.each(["messages", "lib"])("src/%s never uses the old spelling", (dir) => {
    const offenders = filesUnder(path.join(SRC, dir)).filter((f) => fs.readFileSync(f, "utf8").includes(OLD_SPELLING));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
