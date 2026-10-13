import type { ActionState } from "@/lib/action-state";

type Errors = Record<string, string> | undefined;

export function invalidProps(form: string, name: string, errors: Errors) {
  return errors?.[name] ? { "aria-invalid": true as const, "aria-describedby": `${form}-${name}-error` } : {};
}

export function FieldError({ form, name, errors }: { form: string; name: string; errors: Errors }) {
  const message = errors?.[name];
  if (!message) return null;
  return (
    <p id={`${form}-${name}-error`} className="mt-1 text-sm text-warn">
      {message}
    </p>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-sm text-ink-muted">
        {state.message}
      </p>
    );
  }
  if (!state.ok && (state.message || state.errors)) {
    return (
      <p role="alert" className="text-sm text-warn">
        {state.message ?? "Check the fields marked above."}
      </p>
    );
  }
  return null;
}
