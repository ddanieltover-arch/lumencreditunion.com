/** Convert IBAN alphanumeric string to digit string (A=10 … Z=35). */
export function ibanToDigits(value: string): string {
  let out = '';
  for (const ch of value.toUpperCase()) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch >= 'A' && ch <= 'Z') {
      out += String(ch.charCodeAt(0) - 55);
    } else {
      throw new Error(`Invalid IBAN character: ${ch}`);
    }
  }
  return out;
}

/** ISO 13616 mod-97 on a digit string (handles large numbers via chunking). */
export function mod97(digitString: string): number {
  let remainder = 0;
  for (let i = 0; i < digitString.length; i += 7) {
    const block = String(remainder) + digitString.slice(i, i + 7);
    remainder = Number(BigInt(block) % 97n);
  }
  return remainder;
}

/** Compute 2-digit IBAN check digits for country + BBAN. */
export function computeIbanCheckDigits(countryCode: string, bban: string): string {
  const cc = countryCode.toUpperCase();
  const rearranged = `${bban.toUpperCase()}${cc}00`;
  const digits = ibanToDigits(rearranged);
  const check = 98 - mod97(digits);
  return check.toString().padStart(2, '0');
}

export function buildIban(countryCode: string, bban: string): string {
  const check = computeIbanCheckDigits(countryCode, bban);
  return `${countryCode.toUpperCase()}${check}${bban.toUpperCase()}`;
}

/** Validate IBAN structure + mod-97 check digits. */
export function isValidIban(iban: string): boolean {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  try {
    return mod97(ibanToDigits(rearranged)) === 1;
  } catch {
    return false;
  }
}

/**
 * US ABA routing checksum: 3*(d1+d4+d7) + 7*(d2+d5+d8) + 1*(d3+d6+d9) ≡ 0 (mod 10).
 */
export function isValidAbaRouting(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split('').map(Number);
  const sum =
    3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!);
  return sum % 10 === 0;
}

/** Build a valid 9-digit ABA from an 8-digit prefix (computes check digit). */
export function buildAbaRouting(prefix8: string): string {
  if (!/^\d{8}$/.test(prefix8)) {
    throw new Error('ABA prefix must be exactly 8 digits');
  }
  const d = prefix8.split('').map(Number);
  // Placeholders for positions; check digit is d9
  // 3*(d1+d4+d7) + 7*(d2+d5+d8) + (d3+d6+d9) ≡ 0 mod 10
  const partial =
    3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]!);
  const check = (10 - (partial % 10)) % 10;
  return prefix8 + String(check);
}

/** Mexican CLABE check digit (weighted sum mod 10). */
export function computeClabeCheckDigit(clabe17: string): string {
  if (!/^\d{17}$/.test(clabe17)) {
    throw new Error('CLABE body must be 17 digits');
  }
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (Number(clabe17[i]) * weights[i]!) % 10;
  }
  return String((10 - (sum % 10)) % 10);
}

export function buildClabe(body17: string): string {
  return body17 + computeClabeCheckDigit(body17);
}

export function isValidClabe(clabe: string): boolean {
  const clean = clabe.replace(/\s+/g, '');
  if (!/^\d{18}$/.test(clean)) return false;
  return computeClabeCheckDigit(clean.slice(0, 17)) === clean[17];
}

/** Simple Luhn check digit for domestic fallback references. */
export function computeLuhnCheckDigit(payload: string): string {
  const digits = payload.replace(/\D/g, '');
  let sum = 0;
  let alt = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return String((10 - (sum % 10)) % 10);
}
