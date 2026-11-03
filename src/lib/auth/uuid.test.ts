import { describe, expect, it } from "vitest";
import { clerkIdToUuid } from "./uuid";

// Expected values were produced by the pre-migration implementation (git 83bda10, src/lib/auth/server.ts).
// If this test fails, existing users would lose access to their data: fix the code, not the vectors.
describe("clerkIdToUuid", () => {
  it.each([
    ["user_2abcDEFghiJKLmnoPQRstuVWxyz", "a39f6e52-2892-5520-97d5-9ece2f1c9841"],
    ["user_123", "db99edd8-fa85-5bc2-95ec-a499147bb210"],
    ["user_2NNEqL2nrIRdJ194ndJqAHwEfxC", "bbeb61a0-f750-5458-b4a2-1f1afd330a93"],
    ["", "a5120791-7995-5e58-9382-eb1aca252d8a"],
  ])("maps %j to %s", (clerkId, expected) => {
    expect(clerkIdToUuid(clerkId)).toBe(expected);
  });
});
