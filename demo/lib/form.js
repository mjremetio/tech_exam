const INPUT_FOR_TYPE = {
    text: "text",
    long_text: "textarea",
    number: "number",
    boolean: "checkbox",
    date: "date",
    email: "email",
    phone: "tel",
    choice: "select",
    multi_choice: "checkbox_group",
    file: "file",
};
/**
 * Turn a record definition into a form description.
 * Field order in the definition is the field order on the form.
 */
export function describeForm(definition) {
    return {
        client: definition.client,
        record_type: definition.record_type,
        fields: definition.fields.map(describeField),
    };
}
function describeField(field) {
    const input = INPUT_FOR_TYPE[field.type] ?? "text";
    const out = {
        name: field.name,
        label: field.label,
        input,
        required: field.required === true,
    };
    if (field.options) {
        // The definition format has no display labels for options, so we derive
        // one from the value ("old_town" -> "Old town"). See the README; this is
        // a gap in the format, not a feature of it. String() guards against a
        // malformed definition carrying non-string option values.
        out.options = field.options.map((raw) => {
            const value = String(raw);
            return { value, label: humanise(value) };
        });
    }
    const hints = buildHints(field);
    if (hints)
        out.hints = hints;
    if (field.sensitivity)
        out.sensitivity = field.sensitivity;
    return out;
}
function buildHints(field) {
    const c = field.constraints;
    if (!c)
        return undefined;
    const hints = {};
    if (c.min !== undefined)
        hints.min = c.min;
    if (c.max !== undefined)
        hints.max = c.max;
    if (c.min_length !== undefined)
        hints.min_length = c.min_length;
    if (c.max_length !== undefined)
        hints.max_length = c.max_length;
    if (c.pattern !== undefined)
        hints.pattern = c.pattern;
    if (c.min_selected !== undefined)
        hints.min_selected = c.min_selected;
    if (c.max_selected !== undefined)
        hints.max_selected = c.max_selected;
    if (c.accepted !== undefined)
        hints.accept = c.accepted.map((e) => `.${e.toLowerCase()}`);
    return Object.keys(hints).length > 0 ? hints : undefined;
}
function humanise(value) {
    const words = value.replace(/[_-]+/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
