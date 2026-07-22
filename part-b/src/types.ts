/**
 * Types describing the field-definition format as supplied in the starter
 * package, plus the shapes this library returns.
 *
 * The library never imports or hard-codes anything about a particular
 * client; everything it knows arrives at runtime through these shapes.
 */

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "phone"
  | "choice"
  | "multi_choice"
  | "file";

export interface Constraints {
  /** number: minimum value (inclusive) */
  min?: number;
  /** number: maximum value (inclusive) */
  max?: number;
  /** string types: minimum length */
  min_length?: number;
  /** string types: maximum length */
  max_length?: number;
  /** string types: regular expression the whole value must match */
  pattern?: string;
  /** multi_choice: minimum number of selections */
  min_selected?: number;
  /** multi_choice: maximum number of selections */
  max_selected?: number;
  /** file: permitted extensions, lowercase, without dots */
  accepted?: string[];
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  constraints?: Constraints;
  sensitivity?: string;
}

export interface RecordDefinition {
  client: string;
  record_type: string;
  fields: FieldDefinition[];
}

/** A submitted record is just a bag of unknown values keyed by field name. */
export type SubmittedRecord = Record<string, unknown>;

export type Severity = "error" | "warning";

export interface ValidationIssue {
  /** Field name from the definition (or the offending key, for unknown fields). */
  field: string;
  /** Human label from the definition, when the field is defined. */
  label?: string;
  /** Stable machine-readable code, so frontends can map these to their own copy. */
  code: string;
  severity: Severity;
  /** Ready-to-show English message built from the field label. */
  message: string;
  /** Structured details (limits, received values) for programmatic use. */
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  /** True when there are no error-severity issues. Warnings do not block. */
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
