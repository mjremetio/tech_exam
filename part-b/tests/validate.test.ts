import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateRecord } from "../src/validate.js";
import type { RecordDefinition, SubmittedRecord } from "../src/types.js";

function load(path: string) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
}

const defA: RecordDefinition = load("definitions/client-a-city-maintenance.json");
const defB: RecordDefinition = load("definitions/client-b-grant-foundation.json");
const defC: RecordDefinition = load("definitions/client-c-clinic-referrals.json");
const recordsA: SubmittedRecord[] = load("sample-records/client-a-records.json");
const recordsB: SubmittedRecord[] = load("sample-records/client-b-records.json");
const recordsC: SubmittedRecord[] = load("sample-records/client-c-records.json");

function codesFor(result: ReturnType<typeof validateRecord>, field: string) {
  return [...result.errors, ...result.warnings]
    .filter((i) => i.field === field)
    .map((i) => i.code)
    .sort();
}

describe("client A: maintenance reports", () => {
  it("accepts the valid record with no errors or warnings", () => {
    const r = validateRecord(defA, recordsA[0]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("record 2: empty required string, too-short text, unknown field; 0 is a fine number", () => {
    const r = validateRecord(defA, recordsA[1]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "reporter_name")).toEqual(["required"]);
    expect(codesFor(r, "description")).toEqual(["too_short"]);
    expect(codesFor(r, "operator_initials")).toEqual(["unknown_field"]);
    // estimated_cost is 0 with min 0, not a problem
    expect(codesFor(r, "estimated_cost")).toEqual([]);
    // missing photo is optional, not a problem
    expect(codesFor(r, "photo")).toEqual([]);
  });

  it("record 3: wrong-format date, stringly-typed boolean and number, bad option, bad extension", () => {
    const r = validateRecord(defA, recordsA[2]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "reported_at")).toEqual(["invalid_date_format"]);
    expect(codesFor(r, "callback_requested")).toEqual(["invalid_type"]);
    expect(codesFor(r, "estimated_cost")).toEqual(["invalid_type"]);
    expect(codesFor(r, "neighbourhood")).toEqual(["invalid_option"]);
    expect(codesFor(r, "photo")).toEqual(["unaccepted_file_type"]);
  });

  it("record 4: null required values are 'required', null optional values are fine", () => {
    const r = validateRecord(defA, recordsA[3]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "reporter_phone")).toEqual(["required"]);
    expect(codesFor(r, "callback_requested")).toEqual(["required"]);
    expect(codesFor(r, "photo")).toEqual([]);
  });
});

describe("client B: grant applications", () => {
  it("accepts the valid record", () => {
    const r = validateRecord(defB, recordsB[0]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("record 2: pattern, email, stringly number, too many selections, too-short text, bad extension", () => {
    const r = validateRecord(defB, recordsB[1]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "registry_number")).toEqual(["pattern_mismatch"]);
    expect(codesFor(r, "contact_email")).toEqual(["invalid_email"]);
    expect(codesFor(r, "amount_requested")).toEqual(["invalid_type"]);
    expect(codesFor(r, "focus_areas")).toEqual(["too_many_selected"]);
    expect(codesFor(r, "project_description")).toEqual(["too_short"]);
    expect(codesFor(r, "budget_file")).toEqual(["unaccepted_file_type"]);
    // end-before-start is NOT caught: the format cannot express
    // cross-field rules. Documented in the README.
    expect(codesFor(r, "project_end")).toEqual([]);
  });

  it("record 3: below min, empty required multi_choice, invalid round option, missing required file, empty optional phone is fine", () => {
    const r = validateRecord(defB, recordsB[2]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "amount_requested")).toEqual(["below_min"]);
    // empty array on a required field reads as "required", not "too_few_selected"
    expect(codesFor(r, "focus_areas")).toEqual(["required"]);
    expect(codesFor(r, "funding_round")).toEqual(["invalid_option"]);
    expect(codesFor(r, "budget_file")).toEqual(["required"]);
    expect(codesFor(r, "contact_phone")).toEqual([]);
  });
});

describe("client C: patient referrals", () => {
  it("accepts the valid record", () => {
    const r = validateRecord(defC, recordsC[0]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("record 2: consent_given === false is a real value, null optional notes are fine", () => {
    const r = validateRecord(defC, recordsC[1]);
    expect(r.valid).toBe(true);
    expect(codesFor(r, "consent_given")).toEqual([]);
    expect(codesFor(r, "clinical_notes")).toEqual([]);
  });

  it("record 3: pattern failures, non-ISO date, invalid options, negative count", () => {
    const r = validateRecord(defC, recordsC[2]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "national_id")).toEqual(["pattern_mismatch"]);
    expect(codesFor(r, "physician_licence")).toEqual(["pattern_mismatch"]);
    expect(codesFor(r, "date_of_birth")).toEqual(["invalid_date_format"]);
    expect(codesFor(r, "specialty")).toEqual(["invalid_option"]);
    expect(codesFor(r, "urgency")).toEqual(["invalid_option"]);
    expect(codesFor(r, "previous_visits")).toEqual(["below_min"]);
  });

  it("record 4: missing required fields error; unexpected extras warn but do not block", () => {
    const r = validateRecord(defC, recordsC[3]);
    expect(r.valid).toBe(false);
    expect(codesFor(r, "national_id")).toEqual(["required"]);
    expect(codesFor(r, "urgency")).toEqual(["required"]);
    expect(codesFor(r, "guardian_name")).toEqual(["unknown_field"]);
    expect(codesFor(r, "insurance_provider")).toEqual(["unknown_field"]);
    expect(r.warnings.every((w) => w.severity === "warning")).toBe(true);
  });
});

describe("edge cases the samples pushed on", () => {
  const def = (fields: RecordDefinition["fields"]): RecordDefinition => ({
    client: "client-x",
    record_type: "test",
    fields,
  });

  it("whitespace-only strings count as missing", () => {
    const d = def([{ name: "a", label: "A", type: "text", required: true }]);
    expect(validateRecord(d, { a: "   " }).errors[0].code).toBe("required");
  });

  it("underscore-prefixed keys are metadata, never unknown fields", () => {
    const d = def([{ name: "a", label: "A", type: "text", required: false }]);
    expect(validateRecord(d, { _note: "hi", _anything: 1 }).warnings).toEqual([]);
  });

  it("impossible calendar dates are rejected even in the right format", () => {
    const d = def([{ name: "a", label: "A", type: "date", required: true }]);
    expect(validateRecord(d, { a: "2026-02-30" }).errors[0].code).toBe("invalid_date");
    expect(validateRecord(d, { a: "2024-02-29" }).valid).toBe(true); // leap year
  });

  it("file extension matching is case-insensitive", () => {
    const d = def([{ name: "a", label: "A", type: "file", required: true, constraints: { accepted: ["pdf"] } }]);
    expect(validateRecord(d, { a: "scan.PDF" }).valid).toBe(true);
    expect(validateRecord(d, { a: "no-extension" }).errors[0].code).toBe("unaccepted_file_type");
  });

  it("multi_choice must be an array, and duplicates only warn", () => {
    const d = def([{ name: "a", label: "A", type: "multi_choice", required: true, options: ["x", "y"] }]);
    expect(validateRecord(d, { a: "x" }).errors[0].code).toBe("invalid_type");
    const dup = validateRecord(d, { a: ["x", "x"] });
    expect(dup.valid).toBe(true);
    expect(dup.warnings[0].code).toBe("duplicate_options");
  });

  it("NaN and Infinity are not acceptable numbers", () => {
    const d = def([{ name: "a", label: "A", type: "number", required: true }]);
    expect(validateRecord(d, { a: Number.NaN }).errors[0].code).toBe("invalid_type");
    expect(validateRecord(d, { a: Number.POSITIVE_INFINITY }).errors[0].code).toBe("invalid_type");
  });

  it("a broken definition is reported, not silently skipped and not a crash", () => {
    const unknownType = def([{ name: "a", label: "A", type: "wibble" as never, required: true }]);
    expect(validateRecord(unknownType, { a: 1 }).errors[0].code).toBe("invalid_definition");
    const noOptions = def([{ name: "a", label: "A", type: "choice", required: true }]);
    expect(validateRecord(noOptions, { a: "x" }).errors[0].code).toBe("invalid_definition");
    const badPattern = def([{ name: "a", label: "A", type: "text", required: true, constraints: { pattern: "(" } }]);
    expect(validateRecord(badPattern, { a: "anything" }).valid).toBe(true);
  });

  it("a pattern must match the whole value, not a substring", () => {
    const d = def([{ name: "a", label: "A", type: "text", required: true, constraints: { pattern: "[0-9]{3}" } }]);
    expect(validateRecord(d, { a: "abc123def" }).errors[0]?.code).toBe("pattern_mismatch");
    expect(validateRecord(d, { a: "123" }).valid).toBe(true);
  });

  it("a definition without a fields list reports invalid_definition instead of throwing", () => {
    const r = validateRecord({ client: "x", record_type: "x" } as never, { a: 1 });
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe("invalid_definition");
  });

  it("a non-object record reports invalid_record instead of throwing", () => {
    const d = def([{ name: "a", label: "A", type: "text", required: true }]);
    for (const bad of [null, "text", 42, ["a"]]) {
      const r = validateRecord(d, bad as never);
      expect(r.valid).toBe(false);
      expect(r.errors[0].code).toBe("invalid_record");
    }
  });

  it("a field named like an Object.prototype member still reads as missing", () => {
    const d = def([{ name: "constructor", label: "Ctor", type: "text", required: true }]);
    expect(validateRecord(d, {}).errors[0].code).toBe("required");
  });

  it("a completely unseen definition works: the fourth-client guarantee", () => {
    // A client that appears nowhere in the brief: a gym's class bookings.
    const gym: RecordDefinition = {
      client: "client-d",
      record_type: "class_booking",
      fields: [
        { name: "member_email", label: "Member e-mail", type: "email", required: true },
        { name: "class_type", label: "Class", type: "choice", required: true, options: ["yoga", "spin", "boxing"] },
        { name: "addons", label: "Add-ons", type: "multi_choice", required: false, options: ["towel", "locker", "parking"], constraints: { max_selected: 2 } },
        { name: "booked_for", label: "Date", type: "date", required: true },
        { name: "waiver", label: "Waiver accepted", type: "boolean", required: true },
        { name: "medical_note", label: "Medical note", type: "file", required: false, constraints: { accepted: ["pdf"] } },
      ],
    };
    const ok = validateRecord(gym, {
      member_email: "sam@example.com",
      class_type: "spin",
      addons: ["towel"],
      booked_for: "2026-08-01",
      waiver: true,
    });
    expect(ok.valid).toBe(true);

    const bad = validateRecord(gym, {
      member_email: "not-an-email",
      class_type: "swimming",
      addons: ["towel", "locker", "parking"],
      booked_for: "01-08-2026",
      waiver: "yes",
      medical_note: "note.docx",
    });
    expect(bad.valid).toBe(false);
    expect(codesFor(bad, "member_email")).toEqual(["invalid_email"]);
    expect(codesFor(bad, "class_type")).toEqual(["invalid_option"]);
    expect(codesFor(bad, "addons")).toEqual(["too_many_selected"]);
    expect(codesFor(bad, "booked_for")).toEqual(["invalid_date_format"]);
    expect(codesFor(bad, "waiver")).toEqual(["invalid_type"]);
    expect(codesFor(bad, "medical_note")).toEqual(["unaccepted_file_type"]);
  });
});
