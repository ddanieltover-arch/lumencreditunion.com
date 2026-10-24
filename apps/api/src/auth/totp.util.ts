import crypto from 'crypto';
import QRCode from 'qrcode';

// Base32 RFC 4648 alphabet
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 32): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[bytes[i] % 32];
  }
  return result;
}

/** Stable Base32 secret for serverless cold starts (same inputs → same secret). */
export function deriveBase32Secret(material: string, length = 32): string {
  const hash = crypto.createHmac('sha256', material).update('lumenfield-totp-v1').digest();
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[hash[i % hash.length] % 32];
  }
  return result;
}

export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${clean[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Computes the 6-digit TOTP code for a secret at a given counter or time
 */
export function generateTotpCode(secret: string, counter?: number): string {
  const timeStep = 30;
  const count = counter !== undefined ? counter : Math.floor(Date.now() / 1000 / timeStep);

  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(count));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code with +/- 1 window allowance (covering 90 seconds total)
 */
export function verifyTotpCode(token: string, secret: string, window = 1): boolean {
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000 / 30);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const calculated = generateTotpCode(secret, currentTime + errorWindow);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(calculated))) {
      return true;
    }
  }

  return false;
}

/**
 * Generates 8 one-time alphanumeric recovery codes
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const p1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.push(`${p1}-${p2}`);
  }
  return codes;
}

/**
 * Generates an OTP Auth URI and a QR Code Data URL for mobile authenticator enrollment
 */
export async function generateTotpQrCode(
  email: string,
  secret: string,
  issuer = 'Lumenfield',
): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 260,
    margin: 2,
    color: {
      dark: '#0A3D3F', // Brand teal
      light: '#FFFFFF',
    },
  });

  return { otpauthUrl, qrCodeDataUrl };
}
