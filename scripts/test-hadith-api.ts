import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const key = process.env.HADITHAPI_KEY || process.env.HADIHAD_API_KEY;
if (!key) {
  console.error("No HADITHAPI_KEY or HADIHAD_API_KEY found in environment");
  process.exit(1);
}

const url = `https://hadithapi.com/api/books?apiKey=${encodeURIComponent(key)}`;

(async () => {
  try {
    console.log("Requesting:", url);
    const res = await fetch(url);
    const text = await res.text();
    console.log(`Status: ${res.status} ${res.statusText}`);
    try {
      const json = JSON.parse(text);
      console.log("Body (JSON):", JSON.stringify(json, null, 2));
    } catch {
      console.log("Body (text):", text);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
    process.exit(1);
  }
})();
