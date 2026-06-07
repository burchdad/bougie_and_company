"use client";

import { FormEvent, useState } from "react";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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

    const messages = JSON.parse(window.localStorage.getItem("bougie-contact-messages") || "[]") as unknown[];
    window.localStorage.setItem(
      "bougie-contact-messages",
      JSON.stringify([...messages, { firstName, lastName, email, message: customerMessage, createdAt: new Date().toISOString() }])
    );

    event.currentTarget.reset();
    setStatus("success");
    setMessage("Thank you. Your message has been saved for follow-up.");
  }

  return (
    <form className="rounded-lg border border-saddle/15 bg-white p-6 shadow-luxe" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-espresso">First Name<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="firstName" /></label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">Last Name<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="lastName" /></label>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">Email<input className="focus-ring min-h-12 rounded-md border border-saddle/20 px-3 font-normal" name="email" type="email" /></label>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">Message<textarea className="focus-ring min-h-40 rounded-md border border-saddle/20 px-3 py-3 font-normal" name="message" /></label>
      <button className="focus-ring mt-5 rounded-md bg-ink px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-ivory hover:bg-saddle" type="submit">Send Message</button>
      {message ? <p className={`mt-4 text-sm ${status === "success" ? "text-saddle" : "text-ember"}`}>{message}</p> : null}
    </form>
  );
}
