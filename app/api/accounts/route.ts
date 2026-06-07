import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
    };

    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";

    if (!firstName || !lastName || !email) {
      return badRequest("Add your first name, last name, and email.");
    }

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    const sql = getSql();
    await sql`
      INSERT INTO customer_accounts (first_name, last_name, email)
      VALUES (${firstName}, ${lastName}, ${email})
      ON CONFLICT (email)
      DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, updated_at = NOW()
    `;

    return Response.json({ ok: true, message: "Account request saved." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
