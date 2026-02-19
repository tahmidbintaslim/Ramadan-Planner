import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const enPath = path.join(__dirname, "..", "src", "messages", "en.json");
const bnPath = path.join(__dirname, "..", "src", "messages", "bn.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const bn = JSON.parse(fs.readFileSync(bnPath, "utf8"));

function flatten(obj, prefix = "") {
  let res = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(res, flatten(val, key));
    } else {
      res[key] = val;
    }
  }
  return res;
}

const fe = flatten(en);
const fb = flatten(bn);
const keys = new Set([...Object.keys(fe), ...Object.keys(fb)]);
const missingEn = [];
const missingBn = [];

keys.forEach((k) => {
  if (!(k in fe)) missingEn.push(k);
  if (!(k in fb)) missingBn.push(k);
});

console.log("MISSING_IN_EN");
console.log(missingEn.join("\n"));
console.log("\nMISSING_IN_BN");
console.log(missingBn.join("\n"));
