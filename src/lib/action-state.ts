export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  nonce: number;
};

export const INITIAL_ACTION_STATE: ActionState = { ok: false, nonce: 0 };

export function formValues(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) if (typeof value === "string") values[key] = value;
  return values;
}
