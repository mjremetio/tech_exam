# Definition-driven validation and form descriptions

A small TypeScript library in two parts:

1. **`validateRecord(definition, record)`** — checks a submitted record against a set of field definitions supplied as data, and returns a structured list of problems.
2. **`describeForm(definition)`** — turns the same definitions into a renderer-agnostic description of a form.

The library contains no knowledge of any client. No client field names, no client-specific branches, no per-client code paths: every rule it applies arrives at runtime inside the definition object. The same code handles all three sample clients, and should handle a fourth it has never seen, provided that client uses the same format and field types.

## Running it

```bash
npm install
npm test        # 30 tests, including every sample record for all three clients
npm run demo    # validates every sample record and prints the client-a form description
```

Requires Node 18+.

## How it works

`validateRecord` walks the definition's `fields` in order. For each field it decides three things, in this order:

1. **Is the value missing?** Missing means: absent, `null`, a string that is empty or whitespace-only, or an empty array. Missing + required → one `required` error and nothing else (no point telling someone their absent value also fails a pattern). Missing + optional → no issue at all.
2. **Is it the right type?** Types are checked strictly (see the coercion decision below). A wrong type produces one `invalid_type` error and skips the constraint checks, which would be meaningless against a wrongly-typed value.
3. **Does it satisfy its constraints?** Length, range, pattern, options, selection counts, file extensions — whatever the definition carries. A value can fail several constraints at once and all failures are reported.

After the defined fields, any key in the record that is not in the definition (and does not start with `_`) is reported as an `unknown_field`.

Every issue carries: the `field` name, its human `label`, a stable machine-readable `code` (so a frontend can supply its own copy or translations), a ready-to-show English `message` built from the label, a `severity`, and structured `detail` where useful (the limit, the received value, the permitted options). The result separates `errors` from `warnings`; only errors make `valid` false.

`describeForm` is a straightforward mapping: definition order becomes form order, each field type maps to an input kind (`long_text` → `textarea`, `phone` → `tel`, `choice` → `select`, `multi_choice` → `checkbox_group`, …), constraints become renderer `hints` (with file extensions turned into a ready-made `accept` list), and `sensitivity` is passed through so a frontend can decide to mask or gate a field. It names input *kinds*, not HTML tags, so the same description can drive HTML, a native app, or anything else.

## Decisions the format left open

The sample records are clearly designed to force these. What I chose, and why:

**No type coercion.** `"1500"` is not a number and `"yes"` is not a boolean, so both are rejected with `invalid_type`. The alternative, quietly coercing, makes validation lie about the data it approved: downstream code receives a record that the validator called valid but whose types don't match the definitions. If a transport layer (an HTML form, a CSV import) produces strings, converting them is that layer's job, before validation. This is the decision I would defend hardest.

**Empty string, `null`, and absent are all "missing".** The samples use all three interchangeably (`reporter_name: ""`, `reporter_phone: null`, an absent `photo`), and a form frontend genuinely cannot control which one it sends. Treating them differently would make the same user mistake produce three different errors. `false` and `0` are emphatically *not* missing: record C-2's `consent_given: false` and record A-2's `estimated_cost: 0` are valid.

**An empty array on a required `multi_choice` is `required`, not `too_few_selected`.** The user selected nothing; "Focus areas is required" is the truthful message. `min_selected` applies once there is at least one selection.

**Unknown fields are warnings, not errors.** Record A-2's note says some things "look like problems but are not" — `operator_initials` is plausibly a legacy artefact of the old per-client system. Rejecting a record because it carries an extra key would make migrations and integrations brittle; silently dropping it would hide a real signal that the definition is out of date. A warning surfaces it without blocking. Keys starting with `_` are treated as metadata (the starter's own `_note` convention) and ignored entirely.

**Dates must be ISO 8601 (`YYYY-MM-DD`) and must exist.** `11/03/2026` is rejected — is it March 11th or November 3rd? Accepting ambiguous formats means guessing, and in a clinic, guessing a date of birth is not acceptable. `2026-02-30` is also rejected: format-valid but not a real date.

**E-mail and phone are validated for shape, not truth.** E-mail: `something@something.tld`, no spaces. Phone: optional `+`, digits with common separators, 7–15 digits. Anything stricter rejects real addresses and numbers; the only reliable validation of either is sending a message to it, which per the brief the platform does anyway.

**File values are validated as filenames.** The samples supply strings like `"branch.gif"`, so the library checks the extension (case-insensitively) against `accepted`. Checking real content, size, or magic bytes belongs to the upload pipeline, which sees bytes; the validator sees a value.

**A broken definition is reported, not obeyed and not fatal.** An unknown field type or a `choice` without options produces an `invalid_definition` error against that field; an unparseable `pattern` is skipped rather than crashing validation of the whole record. Definitions are data, and data arrives wrong sometimes — a platform whose validator throws on a bad definition takes every client down with one typo.

## What the format cannot express (found while working)

- **Cross-field rules.** Record B-2 has `project_end` before `project_start`, and the note calls it a problem — but the format has no way to say "this field relates to that one", so the library cannot catch it without client-specific code, which is banned. This is the format's most significant gap. I would extend it with a small set of declarative cross-field constraints (e.g. `{"rule": "after", "field": "project_end", "other": "project_start"}`) rather than allowing arbitrary expressions, which turn into an unauditable programming language inside your data.
- **Option display labels.** Options are bare values (`"old_town"`), so the form description derives labels mechanically ("Old town"). Fine for English-ish values; useless the moment a client wants "Old Town district" or Hebrew. Options should be `{value, label}` pairs in the format itself.
- **Conditional requiredness** ("guardian required if patient is a minor") — same class of gap as cross-field rules.
- `sensitivity` values are unconstrained strings with no stated vocabulary; the library passes them through without interpreting them.

## What I would do differently with more time

- **Schema-validate the definition itself** on load (one `invalid_definition` pass up front, with a proper error report), instead of the current lightweight per-field checks.
- **Localisable messages** — the `code` + `detail` structure is already there so a frontend can build its own copy; I would ship a message-catalogue layer on top rather than baking English into the library.
- **Cross-field constraints** as sketched above, with the same data-driven discipline.
- **Property-based tests** (fast-check) — generate random definitions and records, assert invariants like "valid records never produce errors" and "every error names a defined or submitted field".

## Example of Part 2 output

Produced by `describeForm` for `client-a-city-maintenance.json` (this exact output is printed by `npm run demo`):

```json
{
  "client": "client-a",
  "record_type": "maintenance_report",
  "fields": [
    {
      "name": "reporter_name",
      "label": "Reporter name",
      "input": "text",
      "required": true,
      "hints": {
        "max_length": 120
      }
    },
    {
      "name": "reporter_phone",
      "label": "Contact phone",
      "input": "tel",
      "required": true
    },
    {
      "name": "street_address",
      "label": "Street address",
      "input": "text",
      "required": true,
      "hints": {
        "max_length": 200
      }
    },
    {
      "name": "neighbourhood",
      "label": "Neighbourhood",
      "input": "select",
      "required": true,
      "options": [
        {
          "value": "north",
          "label": "North"
        },
        {
          "value": "south",
          "label": "South"
        },
        {
          "value": "east",
          "label": "East"
        },
        {
          "value": "west",
          "label": "West"
        },
        {
          "value": "old_town",
          "label": "Old town"
        },
        {
          "value": "industrial",
          "label": "Industrial"
        }
      ]
    },
    {
      "name": "category",
      "label": "Issue category",
      "input": "select",
      "required": true,
      "options": [
        {
          "value": "pothole",
          "label": "Pothole"
        },
        {
          "value": "streetlight",
          "label": "Streetlight"
        },
        {
          "value": "waste",
          "label": "Waste"
        },
        {
          "value": "tree",
          "label": "Tree"
        },
        {
          "value": "signage",
          "label": "Signage"
        },
        {
          "value": "other",
          "label": "Other"
        }
      ]
    },
    {
      "name": "description",
      "label": "Description of the issue",
      "input": "textarea",
      "required": true,
      "hints": {
        "min_length": 10,
        "max_length": 2000
      }
    },
    {
      "name": "photo",
      "label": "Photo",
      "input": "file",
      "required": false,
      "hints": {
        "accept": [
          ".jpg",
          ".jpeg",
          ".png",
          ".heic"
        ]
      }
    },
    {
      "name": "reported_at",
      "label": "Date reported",
      "input": "date",
      "required": true
    },
    {
      "name": "callback_requested",
      "label": "Resident requested a callback",
      "input": "checkbox",
      "required": true
    },
    {
      "name": "estimated_cost",
      "label": "Estimated repair cost",
      "input": "number",
      "required": false,
      "hints": {
        "min": 0,
        "max": 1000000
      },
      "sensitivity": "internal"
    }
  ]
}
```
