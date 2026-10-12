import crypto from "crypto";

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

export function generateTempPassword(): string {
  // Generate 12 characters guaranteed to have uppercase, lowercase, numbers, and specials
  const uppercaseChars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude I, O
  const lowercaseChars = "abcdefghijkmnpqrstuvwxyz"; // exclude l, o
  const numberChars = "23456789"; // exclude 0, 1
  const specialChars = "!@#$%^&*";
  const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

  const pickRandom = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  // Guarantee at least 2 of each class
  const required = [
    pickRandom(uppercaseChars),
    pickRandom(uppercaseChars),
    pickRandom(lowercaseChars),
    pickRandom(lowercaseChars),
    pickRandom(numberChars),
    pickRandom(numberChars),
    pickRandom(specialChars),
    pickRandom(specialChars),
  ];

  // Fill remaining 4 chars from allChars to reach 12 characters
  for (let i = 0; i < 4; i++) {
    required.push(pickRandom(allChars));
  }

  // Shuffle array using Fisher-Yates
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join("");
}
