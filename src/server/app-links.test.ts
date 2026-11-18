import { describe, expect, it } from "vitest";
import { assetLinks } from "./app-links";

const A = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const B = A.replace(/^14/, "AB");

describe("assetLinks", () => {
  it("is empty until a fingerprint is configured", () => {
    expect(assetLinks(undefined)).toEqual([]);
    expect(assetLinks("")).toEqual([]);
  });

  it("lists every valid fingerprint for the app's package, upper-cased, and drops malformed ones", () => {
    const [entry] = assetLinks(` ${A.toLowerCase()} , not-a-key, ${B}`) as [
      { target: { package_name: string; sha256_cert_fingerprints: string[] }; relation: string[] },
    ];
    expect(entry.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(entry.target.package_name).toBe("space.tahmid.ramadanplanner");
    expect(entry.target.sha256_cert_fingerprints).toEqual([A, B]);
  });
});
