import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";
import { ensureCustomerCaptureTables } from "@/lib/customer-capture";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; firstName?: string; lastName?: string; source?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    const source = body.source?.trim() || "website";

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    await ensureCustomerCaptureTables();
    const sql = getSql();
    await sql`
      INSERT INTO newsletter_subscribers (email, first_name, last_name, source, marketing_eligible)
      VALUES (${email}, ${firstName}, ${lastName}, ${source}, TRUE)
      ON CONFLICT (email)
      DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, newsletter_subscribers.first_name),
        last_name = COALESCE(EXCLUDED.last_name, newsletter_subscribers.last_name),
        source = EXCLUDED.source,
        marketing_eligible = TRUE,
        updated_at = NOW()
    `;

    return Response.json({ ok: true, message: "You are on the Bougie List." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
