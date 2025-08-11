import { neon } from "@neondatabase/serverless"

// Ensure DATABASE_URL is set in your environment variables (e.g., .env.local)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Please set it in your environment variables.")
}

export const sql = neon(databaseUrl)

// For basic password hashing (DO NOT USE IN PRODUCTION - use bcrypt)
export async function hashPassword(password: string): Promise<string> {
  // In a real application, use a robust hashing library like bcrypt
  // For this example, we'll just return the password as hash for simplicity
  return password
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // In a real application, use a robust hashing library like bcrypt
  return password === hashedPassword
}
