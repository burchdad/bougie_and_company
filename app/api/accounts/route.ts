import { badRequest, emailPattern, serverError } from "@/lib/db";
import { upsertCustomerAccount } from "@/lib/customer-capture";

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

    await upsertCustomerAccount({ firstName, lastName, email, source: "account" });

    return Response.json({ ok: true, message: "Account request received. Welcome to Bougie & Company." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
