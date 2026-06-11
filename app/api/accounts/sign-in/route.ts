import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";
import { ensureCustomerCaptureTables } from "@/lib/customer-capture";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    await ensureCustomerCaptureTables();
    const sql = getSql();
    await sql`
      INSERT INTO customer_sign_in_requests (email)
      VALUES (${email})
    `;

    return Response.json({ ok: true, message: "Account lookup received. We will follow up soon." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
