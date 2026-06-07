import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      message?: string;
    };

    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const message = body.message?.trim() || "";

    if (!firstName || !lastName || !email || !message) {
      return badRequest("Please fill out every field.");
    }

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    const sql = getSql();
    await sql`
      INSERT INTO contact_messages (first_name, last_name, email, message)
      VALUES (${firstName}, ${lastName}, ${email}, ${message})
    `;

    return Response.json({ ok: true, message: "Thank you. Your message has been sent." });
  } catch (error) {
    return serverError(error);
  }
}
