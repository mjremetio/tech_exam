/**
 * Demo: runs every sample record for every client through the validator,
 * and prints the Part 2 form description for client A.
 *
 *   npm run demo
 */
import { readFileSync } from "node:fs";
import { validateRecord, describeForm } from "./src/index.js";
import type { RecordDefinition, SubmittedRecord } from "./src/index.js";

const clients = [
  ["client-a-city-maintenance", "client-a-records"],
  ["client-b-grant-foundation", "client-b-records"],
  ["client-c-clinic-referrals", "client-c-records"],
] as const;

for (const [defFile, recFile] of clients) {
  const def: RecordDefinition = JSON.parse(
    readFileSync(new URL(`./definitions/${defFile}.json`, import.meta.url), "utf8")
  );
  const records: SubmittedRecord[] = JSON.parse(
    readFileSync(new URL(`./sample-records/${recFile}.json`, import.meta.url), "utf8")
  );

  console.log(`\n=== ${def.client} · ${def.record_type} ===`);
  records.forEach((record, i) => {
    const { valid, errors, warnings } = validateRecord(def, record);
    console.log(`\nRecord ${i + 1} (${record._note ?? "no note"})`);
    console.log(`  valid: ${valid}`);
    for (const e of errors) console.log(`  ✗ [${e.code}] ${e.message}`);
    for (const w of warnings) console.log(`  ⚠ [${w.code}] ${w.message}`);
  });
}

const defA: RecordDefinition = JSON.parse(
  readFileSync(new URL("./definitions/client-a-city-maintenance.json", import.meta.url), "utf8")
);
console.log("\n=== Part 2: form description for client-a ===\n");
console.log(JSON.stringify(describeForm(defA), null, 2));
