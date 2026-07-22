---
name: add-field-type
description: Add a new field type to the closed vocabulary — the one legitimate platform-level change. Touches four places consistently and adds tests. Use only when no existing type fits a genuine, general need, never to satisfy a single client.
---

# Add a field type

Adding a type is a platform change that benefits every client at once
(architecture note, Q2). Do this only when the need is general. Adding a type to
satisfy one client is a per-client branch in disguise — decline it instead.

## Touch these four places, in order

1. **`src/types.ts`** — add the literal to the `FieldType` union, and any new
   keys to `Constraints`.
2. **`src/validate.ts`** — add the type to `KNOWN_TYPES`, and a `case` in
   `validateField` calling a new `validateX` helper. Follow the existing
   validators: check the type first (one `invalid_type` and stop), then check
   each constraint, reporting structured issues.
3. **`src/form.ts`** — add the type -> input-kind entry in `INPUT_FOR_TYPE`, and
   map any new constraints to renderer hints in `buildHints`.
4. **`tests/`** — add cases for the happy path, the wrong-type path, and each new
   constraint (a valid and an invalid example of each).

## Rules
- Keep it generic. The type must make sense for a client that does not exist yet.
- A wrong-typed value produces exactly one `invalid_type` and skips constraint
  checks (validating constraints against a wrong type is meaningless).
- Update `README.md` (the format section) and the Part 2 example if the form
  mapping changed.

## Done when
`npm test` passes with the new tests, and `npm run demo` still prints a coherent
form description for every client.
