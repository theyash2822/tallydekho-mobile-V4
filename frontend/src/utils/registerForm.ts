// Sign-up form rules, shared with the web portal. The workspace is named on its own field,
// separately from the person's Full Name.

export const WORKSPACE_NAME_MIN = 2;
export const WORKSPACE_NAME_MAX = 60;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** 2–60 characters once trimmed. */
export function isValidWorkspaceName(name: string): boolean {
  const length = name.trim().length;
  return length >= WORKSPACE_NAME_MIN && length <= WORKSPACE_NAME_MAX;
}

export function canProceedRegister(form: {
  name: string;
  email: string;
  workspaceName: string;
  termsAccepted: boolean;
}): boolean {
  return form.name.trim().length > 1
    && isValidEmail(form.email)
    && isValidWorkspaceName(form.workspaceName)
    && form.termsAccepted;
}
