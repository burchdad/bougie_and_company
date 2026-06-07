import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; source?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const source = body.source?.trim() || "website";

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    const sql = getSql();
    await sql`
      INSERT INTO newsletter_subscribers (email, source)
      VALUES (${email}, ${source})
      ON CONFLICT (email)
      DO UPDATE SET source = EXCLUDED.source, updated_at = NOW()
    `;

    return Response.json({ ok: true, message: "You are on the Bougie List." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
