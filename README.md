# Platform Foundation — take-home submission

**The submission is the hosted page → https://techexam.vercel.app**

This repository holds that page and the Part B code behind it.

## What's where

| Path | What it is |
|---|---|
| **[`part-b/`](part-b)** | **The Part B deliverable** — the definition-driven validation + form-description library. This is the code to review and run (`npm test`, `npm run demo`). It contains **no user interface** and no client-specific code, per the brief. |
| [`index.html`](index.html) | The single-page submission itself: Part A (architecture note), the Part B link, Part C (reflection), and the AI-usage account. Hosted at the link above. |
| [`demo/`](demo) | **Not the deliverable — an optional extra.** A live, in-browser page that runs the *compiled* Part B library so you can see it work, including on a fourth client (`client-d`) it has never seen. Hosted at [`/demo`](https://techexam.vercel.app/demo). It duplicates the compiled library and the definitions purely as static assets to fetch; the source of truth is `part-b/`. |
| [`architecture/`](architecture) | The platform data model referenced by Part A: `schema.sql` (Postgres DDL with the RLS policy) and `schema.svg` (ER diagram). |

## Part B in one line

`validateRecord(definition, record)` and `describeForm(definition)` — driven entirely by field definitions supplied at runtime, with no client-specific code. Full write-up in **[`part-b/README.md`](part-b/README.md)**.

> If you only look at one thing, look at `part-b/`. Everything else supports it.
