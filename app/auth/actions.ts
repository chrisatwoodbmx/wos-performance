"use server";

import { sql, verifyPassword } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(_prevState: FormData, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const users =
    await sql`SELECT id, username, password_hash FROM users WHERE username = ${username}`;
  const user = users[0];

  if (user && (await verifyPassword(password, user.password_hash))) {
    // In a real app, use a proper session management library
    (await cookies()).set("session", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
    redirect("/");
  } else {
    return { error: "Invalid credentials." };
  }
}

export async function logout() {
  (await cookies()).delete("session");
  redirect("/login");
}

export async function getCurrentUser() {
  const sessionId = (await cookies()).get("session")?.value;
  if (!sessionId) {
    return null;
  }
  const users =
    await sql`SELECT id, username FROM users WHERE id = ${sessionId}`;
  return users[0] || null;
}
