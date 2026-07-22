---
name: add-client-definition
description: Scaffold a new client's record-type definition in the field-definition format, then validate the client's real records against it with validateRecord. Use when onboarding a client or adding a record type — configuration, not code.
---

# Add a client definition

Onboarding a client is authoring configuration, not writing code (architecture
note, Q2). This skill turns a description of what a client tracks into a
definition file and proves it before anyone builds on it.

## Steps

1. **Gather the shape.** For each field the client records, capture:
   - `name` — the key used in submitted records
   - `label` — what staff see
   - `type` — one of the closed vocabulary in `src/types.ts`:
     `text`, `long_text`, `number`, `boolean`, `date`, `email`, `phone`,
     `choice`, `multi_choice`, `file`
   - `required`
   - `options` — for `choice` / `multi_choice`
   - `constraints` — `min`, `max`, `min_length`, `max_length`, `pattern`,
     `min_selected`, `max_selected`, `accepted`
   - `sensitivity` — if a role must not read the field

2. **Write** `definitions/<client>-<record-type>.json`:
   ```json
   { "client": "...", "record_type": "...", "fields": [ /* ... */ ] }
   ```

3. **Validate the definition against the client's real past records.** This is
   the step people skip. Put a handful of their historical records in
   `sample-records/<client>-records.json` (each may carry a `_note`), then run
   them through the library — `npm run demo`, or a short `tsx` script calling
   `validateRecord(definition, record)`.
   - Records the client considers good MUST come back `valid: true`.
   - Records they would reject MUST fail, and the message must read correctly to
     their staff.
   - Any mismatch means the definition (or your understanding) is wrong. Fix the
     **definition**, never the library.

4. **Do not touch `src/`.** If the client needs something the format cannot
   express — a rule between two fields, a computed value — that is an escalation
   (architecture note, Q8), not a branch in the code here.

## Done when
`npm test` still passes and the new client's sample records validate exactly the
way the client expects.
