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
  // Clean, readable alphanumeric format (10 characters, uppercase letters and digits)
  // Excludes ambiguous characters: 0, O, 1, I, l
  const uppercaseChars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 chars
  const numberChars = "23456789"; // 8 chars
  const allChars = uppercaseChars + numberChars;

  const pickRandom = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  // Guarantee at least 2 letters and 2 digits
  const chars = [
    pickRandom(uppercaseChars),
    pickRandom(uppercaseChars),
    pickRandom(numberChars),
    pickRandom(numberChars),
  ];

  // Fill remaining 6 characters
  for (let i = 0; i < 6; i++) {
    chars.push(pickRandom(allChars));
  }

  // Shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
