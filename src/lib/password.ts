export interface PasswordStrength {
  valid: boolean;
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const length = (password || "").length >= 8;
  const uppercase = /[A-Z]/.test(password || "");
  const lowercase = /[a-z]/.test(password || "");
  const number = /[0-9]/.test(password || "");
  const special = /[^A-Za-z0-9]/.test(password || "");

  return {
    valid: length && uppercase && lowercase && number && special,
    length,
    uppercase,
    lowercase,
    number,
    special,
  };
}
