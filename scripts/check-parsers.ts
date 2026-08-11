/**
 * Dev check: run every fixture email in data/scan-fixtures.json through the
 * parser layer and print what each one produced.  Usage: npx tsx scripts/check-parsers.ts
 */
import fs from "fs";
import path from "path";
import { parseEmail } from "../lib/scan/parsers";
import type { EmailMessage } from "../lib/scan/source";

const file = path.join(process.cwd(), "data", "scan-fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(file, "utf-8")) as EmailMessage[];

let parsed = 0;
for (const msg of fixtures) {
  const r = parseEmail(msg);
  const label = `${msg.from.replace(/.*@/, "@")}  "${msg.subject.slice(0, 60)}"`;
  if (!r) {
    console.log(`SKIP   ${label}`);
    continue;
  }
  parsed++;
  console.log(
    `OK     ${label}\n       -> [${r.parser}] ${r.kind}  vendor="${r.vendor}"  amount=${r.amount}${r.date ? `  date=${r.date}` : ""}`
  );
}
console.log(`\n${parsed}/${fixtures.length} fixtures parsed`);
