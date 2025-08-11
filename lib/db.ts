import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

// Ensure DATABASE_URL is set in your environment variables (e.g., .env.local)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Please set it in your environment variables.",
  );
}

export const sql = neon(databaseUrl);

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateSessionToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}
