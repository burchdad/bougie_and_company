"use client";

import { FormEvent, useState } from "react";
import { readFormResponse } from "@/lib/form-response";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const email = String(form.get("email") || "").trim();
    const customerMessage = String(form.get("message") || "").trim();

    if (!firstName || !lastName || !email || !customerMessage) {
      setStatus("error");
      setMessage("Please fill out every field.");
      return;
    }

    if (!emailPattern.test(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, message: customerMessage })
      });
      const result = await readFormResponse(response, "Thank you. Your message has been sent.");

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message || "We could not send your message yet.");
        return;
      }

      formElement.reset();
      setStatus("success");
      setMessage(result.message || "Thank you. Your message has been sent.");
    } catch {
      setStatus("error");
      setMessage("We could not send your message right now. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="rounded-lg border border-saddle/15 bg-white p-6 shadow-luxe" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-espresso">First Name<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="firstName" /></label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">Last Name<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="lastName" /></label>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">Email<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="email" type="email" /></label>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">Message<textarea className="focus-ring min-h-40 rounded-md border border-saddle/20 px-3 py-3 font-normal" name="message" /></label>
      <button className="focus-ring mt-5 rounded-md bg-ink px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-ivory hover:bg-saddle" disabled={submitting} type="submit">
        {submitting ? "Sending..." : "Send Message"}
      </button>
      {message ? <p className={`mt-4 text-sm ${status === "success" ? "text-saddle" : "text-ember"}`}>{message}</p> : null}
    </form>
  );
}
