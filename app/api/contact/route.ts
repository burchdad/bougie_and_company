import { badRequest, emailPattern, getSql, serverError } from "@/lib/db";
import { ensureCustomerCaptureTables } from "@/lib/customer-capture";

export const runtime = "nodejs";

type ContactPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  subject?: string;
  source?: string;
  message?: string;
};

function contactRecipient() {
  return process.env.CONTACT_TO_EMAIL || process.env.SITE_CONTACT_EMAIL || process.env.RESEND_TO_EMAIL || "";
}

async function sendWithResend(payload: Required<Pick<ContactPayload, "firstName" | "lastName" | "email" | "message">> & ContactPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = contactRecipient();

  if (!apiKey || !to) {
    return false;
  }

  const subject = payload.subject || "New Bougie & Company contact request";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Bougie & Company <onboarding@resend.dev>",
      to,
      reply_to: payload.email,
      subject,
      text: [
        subject,
        "",
        `Name: ${payload.firstName} ${payload.lastName}`,
        `Email: ${payload.email}`,
        payload.phone ? `Phone: ${payload.phone}` : "",
        payload.source ? `Source: ${payload.source}` : "",
        "",
        payload.message
      ].filter(Boolean).join("\n")
    })
  });

  if (!response.ok) {
    throw new Error(`Resend contact email failed with ${response.status}.`);
  }

  return true;
}

async function sendWithFormspree(payload: Required<Pick<ContactPayload, "firstName" | "lastName" | "email" | "message">> & ContactPayload) {
  const endpoint = process.env.FORMSPREE_ENDPOINT || process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || "";

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `${payload.firstName} ${payload.lastName}`,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone || "",
      subject: payload.subject || "New Bougie & Company contact request",
      source: payload.source || "website",
      message: payload.message
    })
  });

  if (!response.ok) {
    throw new Error(`Formspree contact email failed with ${response.status}.`);
  }

  return true;
}

async function sendContactNotification(payload: Required<Pick<ContactPayload, "firstName" | "lastName" | "email" | "message">> & ContactPayload) {
  try {
    if (await sendWithResend(payload)) {
      return "resend";
    }

    if (await sendWithFormspree(payload)) {
      return "formspree";
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Contact notification failed.");
  }

  return "saved";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;

    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const phone = body.phone?.trim() || "";
    const subject = body.subject?.trim() || "New Bougie & Company contact request";
    const source = body.source?.trim() || "website";
    const message = body.message?.trim() || "";

    if (!firstName || !lastName || !email || !message) {
      return badRequest("Please fill out every field.");
    }

    if (!emailPattern.test(email)) {
      return badRequest("Enter a valid email address.");
    }

    await ensureCustomerCaptureTables();
    const sql = getSql();
    await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS subject TEXT`;
    await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS source TEXT`;
    await sql`
      INSERT INTO contact_messages (first_name, last_name, email, phone, subject, source, message)
      VALUES (${firstName}, ${lastName}, ${email}, ${phone || null}, ${subject}, ${source}, ${message})
    `;
    const delivery = await sendContactNotification({ firstName, lastName, email, phone, subject, source, message });

    return Response.json(
      {
        ok: true,
        message: delivery === "saved" ? "Thank you. Your request has been saved and the boutique will follow up soon." : "Thank you. Your message has been sent."
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return serverError(error);
  }
}
