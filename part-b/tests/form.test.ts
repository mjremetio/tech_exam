import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { describeForm } from "../src/form.js";
import type { RecordDefinition } from "../src/types.js";

function load(path: string): RecordDefinition {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
}

const defA = load("definitions/client-a-city-maintenance.json");
const defB = load("definitions/client-b-grant-foundation.json");
const defC = load("definitions/client-c-clinic-referrals.json");

describe("describeForm", () => {
  it("preserves definition order exactly", () => {
    const form = describeForm(defA);
    expect(form.fields.map((f) => f.name)).toEqual(defA.fields.map((f) => f.name));
  });

  it("maps every field type to the right input kind", () => {
    const inputs = Object.fromEntries(
      describeForm(defA).fields.map((f) => [f.name, f.input])
    );
    expect(inputs).toMatchObject({
      reporter_name: "text",
      reporter_phone: "tel",
      neighbourhood: "select",
      description: "textarea",
      photo: "file",
      reported_at: "date",
      callback_requested: "checkbox",
      estimated_cost: "number",
    });
    const b = Object.fromEntries(describeForm(defB).fields.map((f) => [f.name, f.input]));
    expect(b.contact_email).toBe("email");
    expect(b.focus_areas).toBe("checkbox_group");
  });

  it("derives option labels from values", () => {
    const neighbourhood = describeForm(defA).fields.find((f) => f.name === "neighbourhood")!;
    expect(neighbourhood.options).toContainEqual({ value: "old_town", label: "Old town" });
  });

  it("carries constraints through as renderer hints, with file accept lists dotted", () => {
    const form = describeForm(defB);
    const amount = form.fields.find((f) => f.name === "amount_requested")!;
    expect(amount.hints).toEqual({ min: 1000, max: 500000 });
    const budget = form.fields.find((f) => f.name === "budget_file")!;
    expect(budget.hints?.accept).toEqual([".pdf", ".xlsx", ".xls"]);
    const focus = form.fields.find((f) => f.name === "focus_areas")!;
    expect(focus.hints).toEqual({ min_selected: 1, max_selected: 3 });
  });

  it("passes sensitivity through so a frontend can gate rendering", () => {
    const notes = describeForm(defC).fields.find((f) => f.name === "clinical_notes")!;
    expect(notes.sensitivity).toBe("confidential");
    const name = describeForm(defC).fields.find((f) => f.name === "patient_name")!;
    expect(name.sensitivity).toBeUndefined();
  });

  it("does not crash on a malformed non-string option value", () => {
    const d = {
      client: "x",
      record_type: "x",
      fields: [{ name: "a", label: "A", type: "choice", required: true, options: [123 as never] }],
    } as RecordDefinition;
    expect(describeForm(d).fields[0].options).toEqual([{ value: "123", label: "123" }]);
  });

  it("required is always an explicit boolean", () => {
    for (const def of [defA, defB, defC]) {
      for (const f of describeForm(def).fields) {
        expect(typeof f.required).toBe("boolean");
      }
    }
  });
});
