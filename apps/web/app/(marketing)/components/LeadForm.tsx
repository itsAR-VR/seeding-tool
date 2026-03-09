"use client";

import { useActionState } from "react";
import { LeadFormState, submitLead } from "../actions/submit-form";
import { getCalendlyHref } from "./analytics";

type LeadField = {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: "email" | "text" | "url";
};

type LeadFormProps = {
  className?: string;
  fields: LeadField[];
  formId: string;
  intro?: string;
  source: string;
  submitLabel: string;
};

const initialState: LeadFormState = {
  status: "idle",
  message: "",
};

export default function LeadForm({
  className,
  fields,
  formId,
  intro,
  source,
  submitLabel,
}: LeadFormProps) {
  const calendlyHref = getCalendlyHref();
  const [state, formAction, pending] = useActionState(submitLead, initialState);
  const shellClassName = [
    "lead-form-shell",
    calendlyHref ? "" : "lead-form-shell-single",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <form action={formAction} className="lead-form" id={formId}>
        <input type="hidden" name="source" value={source} />
        {intro ? <p className="lead-form-intro">{intro}</p> : null}
        <div className="lead-form-grid">
          {fields.map((field) => (
            <label className="lead-field" key={field.name}>
              <span className="lead-field-label">
                {field.label}
                {field.required ? <em className="field-required">(required)</em> : null}
              </span>
              <input
                name={field.name}
                placeholder={field.placeholder}
                required={field.required}
                type={field.type || "text"}
              />
            </label>
          ))}
        </div>
        <button className="btn btn-solid" type="submit" disabled={pending}>
          {pending ? "Sending..." : submitLabel}
        </button>
        {state.status !== "idle" ? (
          <p className={`form-state form-state-${state.status}`} role="status">
            {state.message}
          </p>
        ) : null}
      </form>
      {calendlyHref ? (
        <aside className="calendly-card">
          <p className="eyebrow">Prefer to pick a time?</p>
          <h3>Open a calendar and lock a slot.</h3>
          <p>If a live walkthrough is easier than back-and-forth email, book it directly.</p>
          <a className="btn btn-ghost" href={calendlyHref} rel="noreferrer" target="_blank">
            Open Calendly
          </a>
        </aside>
      ) : null}
    </div>
  );
}
