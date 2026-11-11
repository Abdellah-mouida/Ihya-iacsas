export interface PasswordStrength {
  valid: boolean;
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

/** Deterministic validation shared by the browser form and server actions. */
export function validatePasswordStrength(password: string): PasswordStrength {
  const value = password || "";
  const length = value.length >= 8;
  const uppercase = /[A-Z]/.test(value);
  const lowercase = /[a-z]/.test(value);
  const number = /[0-9]/.test(value);
  const special = /[^A-Za-z0-9]/.test(value);

  return {
    valid: length && uppercase && lowercase && number && special,
    length,
    uppercase,
    lowercase,
    number,
    special,
  };
}
