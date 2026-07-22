# CLAUDE.md — definition-driven-forms (Part B)

Project context for Claude Code. Read this before changing anything.

## What this is
A small TypeScript library, two functions, zero client knowledge:
- `validateRecord(definition, record)` — validate a submitted record against a
  field-definition supplied as data; returns structured errors + warnings.
- `describeForm(definition)` — turn the same definition into a renderer-agnostic
  form description (a data structure, not a UI).

The same code handles every client. Definitions arrive at runtime.

## The one hard rule
**No knowledge of any specific client may enter the code.** No client field
names, no `if (client === ...)`, no per-client branches. A fourth client
(unseen) must work with zero code changes. This is greppable and non-negotiable.

## Commands
- `npm test`      — 30 tests (Vitest), incl. every sample record + edge cases
- `npm run demo`  — validate all sample records, print the Part 2 form output
- `npm run build` — compile to `dist/` (used by the live browser demo)

Requires Node 18+. If a shell defaults to an older Node, switch first.

## Layout
- `src/types.ts`    — the definition format + result shapes (the vocabulary)
- `src/validate.ts` — `validateRecord` and the per-type validators
- `src/form.ts`     — `describeForm` and the type -> input-kind mapping
- `src/index.ts`    — public exports
- `definitions/`    — the three starter clients (unmodified starter data)
- `sample-records/` — starter sample records (unmodified)
- `tests/`          — validate + form tests

## Design invariants (don't regress these — they're decisions, see README)
- No type coercion: `"1500"` is not a number; reject with `invalid_type`.
- Missing = absent | null | empty/whitespace string | empty array. `false`/`0`
  are real values, never missing.
- Unknown extra fields -> `warning`, not error. `_`-prefixed keys are metadata.
- Patterns match the whole value (anchored). Dates must be real ISO calendar dates.
- A broken definition is reported (`invalid_definition`), never thrown.

## Extension points
- **Add a client** -> data only. Write a definition JSON; no code changes.
  See skill `.claude/skills/add-client-definition`.
- **Add a field type** -> the one legitimate platform change. Touches the closed
  vocabulary in four places. See skill `.claude/skills/add-field-type`.

## Before you finish
Run `npm test`. If you changed the format, update `README.md` (it documents the
format-left-open decisions) and the Part 2 example.
