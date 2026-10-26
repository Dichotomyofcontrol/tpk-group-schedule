/**
 * Ask the Archivist import route to store one character summary.
 * Does not call an AI API. The prose is in the JSON file you pass.
 *
 *   TPK_IMPORT_SECRET=... node scripts/character-summary.mjs https://taverning.com summary.json
 *
 * summary.json: { "cid", "name", "text", "facts": { "class", "ancestry", "role", "moment" } }
 */
import { readFileSync } from "node:fs";

const [origin, file] = process.argv.slice(2);
const secret = process.env.TPK_IMPORT_SECRET || "";
if (!origin || !file || !secret) {
  console.error("Usage: TPK_IMPORT_SECRET=... node scripts/character-summary.mjs https://taverning.com summary.json");
  process.exit(1);
}
const payload = readFileSync(file, "utf8");
const res = await fetch(new URL("/api/import/character-summary", origin), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
  body: payload,
});
const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
