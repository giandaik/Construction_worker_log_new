export function validateJWTSecret(): string {
  const secret = process.env.NEXT_JWT_SECRET;

  if (!secret) {
    throw new Error('NEXT_JWT_SECRET environment variable is not configured');
  }

  if (secret.length < 32) {
    throw new Error('NEXT_JWT_SECRET must be at least 32 characters long for security');
  }

  return secret;
}
