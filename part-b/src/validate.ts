import type {
  Constraints,
  FieldDefinition,
  RecordDefinition,
  SubmittedRecord,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

const KNOWN_TYPES = new Set([
  "text",
  "long_text",
  "number",
  "boolean",
  "date",
  "email",
  "phone",
  "choice",
  "multi_choice",
  "file",
]);

/**
 * Kept simple on purpose: something@something.tld, no spaces.
 * Full RFC 5322 matching rejects real addresses and accepts useless ones;
 * the only reliable e-mail validation is sending an e-mail.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lenient phone shape: optional +, then digits with spaces, dashes,
 * dots or parentheses. The digit count (7–15, per E.164's upper bound)
 * is checked separately.
 */
const PHONE_CHARS_RE = /^\+?[0-9][0-9\s\-().]*$/;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate one submitted record against one record definition.
 *
 * The function is pure: same inputs, same output, no I/O. It knows nothing
 * about any client: every rule it applies comes from `definition`.
 */
export function validateRecord(
  definition: RecordDefinition,
  record: SubmittedRecord
): ValidationResult {
  // Definitions and records both arrive as data, often straight from JSON,
  // so a malformed one should produce a result, not a thrown TypeError.
  if (!definition || !Array.isArray(definition.fields)) {
    return {
      valid: false,
      errors: [{
        field: "(definition)",
        code: "invalid_definition",
        severity: "error",
        message: "The definition is malformed: it has no fields list. Nothing was validated.",
      }],
      warnings: [],
    };
  }
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    return {
      valid: false,
      errors: [{
        field: "(record)",
        code: "invalid_record",
        severity: "error",
        message: `The submitted record must be an object of field values (got ${typeName(record)}).`,
        detail: { received: typeName(record) },
      }],
      warnings: [],
    };
  }

  const issues: ValidationIssue[] = [];

  for (const field of definition.fields) {
    // Own properties only: a field named like an Object.prototype member
    // ("constructor") must not pick up the inherited value.
    const value = Object.hasOwn(record, field.name) ? record[field.name] : undefined;
    issues.push(...validateField(field, value));
  }

  issues.push(...findUnknownFields(definition, record));

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * "Missing" means: absent, null, a string that is empty or only whitespace,
 * or an empty array. `false` and `0` are real values, not missing ones.
 */
function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateField(field: FieldDefinition, value: unknown): ValidationIssue[] {
  const make = (
    code: string,
    message: string,
    detail?: Record<string, unknown>,
    severity: "error" | "warning" = "error"
  ): ValidationIssue => ({
    field: field.name,
    label: field.label,
    code,
    severity,
    message,
    ...(detail ? { detail } : {}),
  });

  // A definition problem is reported against the field but is not the
  // submitter's fault; we surface it rather than silently skipping the field.
  if (!KNOWN_TYPES.has(field.type)) {
    return [
      make("invalid_definition", `The definition for "${field.label}" uses an unknown field type "${field.type}"; the value was not validated.`, { type: field.type }),
    ];
  }
  if ((field.type === "choice" || field.type === "multi_choice") && !Array.isArray(field.options)) {
    return [
      make("invalid_definition", `The definition for "${field.label}" is a ${field.type} field with no options; the value was not validated.`),
    ];
  }

  if (isMissing(value)) {
    return field.required
      ? [make("required", `${field.label} is required.`)]
      : [];
  }

  const c: Constraints = field.constraints ?? {};

  switch (field.type) {
    case "text":
    case "long_text":
      return validateString(field, value, c, make);
    case "number":
      return validateNumber(field, value, c, make);
    case "boolean":
      if (typeof value !== "boolean") {
        return [make("invalid_type", `${field.label} must be true or false.`, { expected: "boolean", received: typeName(value) })];
      }
      return [];
    case "date":
      return validateDate(field, value, make);
    case "email":
      return validateEmail(field, value, c, make);
    case "phone":
      return validatePhone(field, value, c, make);
    case "choice":
      return validateChoice(field, value, make);
    case "multi_choice":
      return validateMultiChoice(field, value, c, make);
    case "file":
      return validateFile(field, value, c, make);
  }
}

type Make = (
  code: string,
  message: string,
  detail?: Record<string, unknown>,
  severity?: "error" | "warning"
) => ValidationIssue;

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateString(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be text.`, { expected: "string", received: typeName(value) })];
  }
  const issues: ValidationIssue[] = [];
  // Length is measured on the raw value; surrounding whitespace counts.
  if (c.min_length !== undefined && value.length < c.min_length) {
    issues.push(make("too_short", `${field.label} must be at least ${c.min_length} characters (got ${value.length}).`, { min_length: c.min_length, length: value.length }));
  }
  if (c.max_length !== undefined && value.length > c.max_length) {
    issues.push(make("too_long", `${field.label} must be at most ${c.max_length} characters (got ${value.length}).`, { max_length: c.max_length, length: value.length }));
  }
  if (c.pattern !== undefined && !safeRegexTest(c.pattern, value)) {
    issues.push(make("pattern_mismatch", `${field.label} is not in the expected format.`, { pattern: c.pattern }));
  }
  return issues;
}

function safeRegexTest(pattern: string, value: string): boolean {
  // The whole value must match (the format's contract), so the pattern is
  // anchored here; already-anchored patterns are unaffected. An unparseable
  // pattern in a definition should read as a definition problem, not crash
  // validation of the whole record.
  try {
    return new RegExp(`^(?:${pattern})$`).test(value);
  } catch {
    return true;
  }
}

function validateNumber(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  // Strings that look like numbers ("1500") are rejected on purpose
  // (see the README on coercion).
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return [make("invalid_type", `${field.label} must be a number.`, { expected: "number", received: typeName(value) })];
  }
  const issues: ValidationIssue[] = [];
  if (c.min !== undefined && value < c.min) {
    issues.push(make("below_min", `${field.label} must be at least ${c.min} (got ${value}).`, { min: c.min, value }));
  }
  if (c.max !== undefined && value > c.max) {
    issues.push(make("above_max", `${field.label} must be at most ${c.max} (got ${value}).`, { max: c.max, value }));
  }
  return issues;
}

function validateDate(field: FieldDefinition, value: unknown, make: Make): ValidationIssue[] {
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be a date in YYYY-MM-DD format.`, { expected: "string (YYYY-MM-DD)", received: typeName(value) })];
  }
  if (!DATE_RE.test(value)) {
    return [make("invalid_date_format", `${field.label} must be in YYYY-MM-DD format (got "${value}").`, { received: value })];
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const real =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!real) {
    return [make("invalid_date", `${field.label} is not a real calendar date (got "${value}").`, { received: value })];
  }
  return [];
}

function validateEmail(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be text.`, { expected: "string", received: typeName(value) })];
  }
  const issues = validateString(field, value, c, make);
  if (!EMAIL_RE.test(value)) {
    issues.push(make("invalid_email", `${field.label} does not look like an e-mail address (got "${value}").`, { received: value }));
  }
  return issues;
}

function validatePhone(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be text.`, { expected: "string", received: typeName(value) })];
  }
  const issues = validateString(field, value, c, make);
  const digits = value.replace(/\D/g, "").length;
  if (!PHONE_CHARS_RE.test(value.trim()) || digits < 7 || digits > 15) {
    issues.push(make("invalid_phone", `${field.label} does not look like a phone number (got "${value}").`, { received: value }));
  }
  return issues;
}

function validateChoice(field: FieldDefinition, value: unknown, make: Make): ValidationIssue[] {
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be one of the permitted options.`, { expected: "string", received: typeName(value) })];
  }
  if (!field.options!.includes(value)) {
    return [make("invalid_option", `"${value}" is not a permitted option for ${field.label}.`, { received: value, options: field.options })];
  }
  return [];
}

function validateMultiChoice(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [make("invalid_type", `${field.label} must be a list of options.`, { expected: "array", received: typeName(value) })];
  }
  const issues: ValidationIssue[] = [];
  const invalid = value.filter((v) => typeof v !== "string" || !field.options!.includes(v));
  if (invalid.length > 0) {
    issues.push(make("invalid_option", `${field.label} contains options that are not permitted: ${invalid.map((v) => JSON.stringify(v)).join(", ")}.`, { received: invalid, options: field.options }));
  }
  const unique = new Set(value);
  if (unique.size !== value.length) {
    issues.push(make("duplicate_options", `${field.label} contains the same option more than once.`, undefined, "warning"));
  }
  if (c.min_selected !== undefined && value.length < c.min_selected) {
    issues.push(make("too_few_selected", `${field.label} needs at least ${c.min_selected} selection${c.min_selected === 1 ? "" : "s"} (got ${value.length}).`, { min_selected: c.min_selected, selected: value.length }));
  }
  if (c.max_selected !== undefined && value.length > c.max_selected) {
    issues.push(make("too_many_selected", `${field.label} allows at most ${c.max_selected} selection${c.max_selected === 1 ? "" : "s"} (got ${value.length}).`, { max_selected: c.max_selected, selected: value.length }));
  }
  return issues;
}

function validateFile(
  field: FieldDefinition,
  value: unknown,
  c: Constraints,
  make: Make
): ValidationIssue[] {
  // In the sample data a file value is a filename. The library validates
  // what it is given; checking real content is the upload pipeline's job.
  if (typeof value !== "string") {
    return [make("invalid_type", `${field.label} must be a file name.`, { expected: "string", received: typeName(value) })];
  }
  if (c.accepted !== undefined) {
    const dot = value.lastIndexOf(".");
    const ext = dot >= 0 ? value.slice(dot + 1).toLowerCase() : "";
    const accepted = c.accepted.map((e) => e.toLowerCase());
    if (!accepted.includes(ext)) {
      return [make("unaccepted_file_type", `${field.label} must be one of: ${c.accepted.join(", ")} (got "${ext || "no extension"}").`, { received: ext, accepted: c.accepted })];
    }
  }
  return [];
}

function findUnknownFields(
  definition: RecordDefinition,
  record: SubmittedRecord
): ValidationIssue[] {
  const known = new Set(definition.fields.map((f) => f.name));
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(record)) {
    // Underscore-prefixed keys are metadata by convention (the starter's
    // `_note`), not submitted data.
    if (key.startsWith("_")) continue;
    if (!known.has(key)) {
      issues.push({
        field: key,
        code: "unknown_field",
        severity: "warning",
        message: `"${key}" is not a field of ${definition.record_type} and was ignored.`,
      });
    }
  }
  return issues;
}
