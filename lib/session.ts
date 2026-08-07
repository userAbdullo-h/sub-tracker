import { auth } from "@/auth";

export function devBypass(): boolean {
  return process.env.DEV_BYPASS_AUTH === "true";
}

/** Returns the signed-in user's email, or null if not authenticated. */
export async function currentUser(): Promise<string | null> {
  if (devBypass()) return process.env.ALLOWED_EMAIL ?? "dev@localhost";
  const session = await auth();
  return session?.user?.email ?? null;
}

/** Throws a Response(401) if not authenticated — for API routes. */
export async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  return user;
}
