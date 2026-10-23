import argon2 from 'argon2';

export interface Argon2Options {
  memoryCost?: number; // 64 MB = 65536 KB
  timeCost?: number;   // 3 iterations
  parallelism?: number;// 1 lane
}

export async function hashPassword(
  password: string,
  options: Argon2Options = { memoryCost: 65536, timeCost: 3, parallelism: 1 },
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: options.memoryCost || 65536,
    timeCost: options.timeCost || 3,
    parallelism: options.parallelism || 1,
  });
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch (err) {
    return false;
  }
}
