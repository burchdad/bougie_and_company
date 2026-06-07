import { neon } from "@neondatabase/serverless";

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function badRequest(message: string) {
  return Response.json({ ok: false, message }, { status: 400 });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  console.error(message);
  return Response.json({ ok: false, message: "The form backend is not available yet." }, { status: 500 });
}
