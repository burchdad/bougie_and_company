"use client";

import { FormEvent, useState } from "react";
import { readFormResponse } from "@/lib/form-response";
import { cn } from "@/lib/utils";

type NewsletterFormProps = {
  buttonLabel?: string;
  dark?: boolean;
  onSuccess?: () => void;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterForm({ buttonLabel = "Sign Up", dark = false, onSuccess }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!emailPattern.test(trimmedEmail)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, source: "website" })
      });
      const result = await readFormResponse(response, "You are on the Bougie List.");

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message || "We could not save your signup yet.");
        return;
      }

      setStatus("success");
      setMessage(result.message || "You are on the Bougie List.");
      setEmail("");
      onSuccess?.();
    } catch {
      setStatus("error");
      setMessage("We could not connect to the signup backend.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-2" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="Email address"
          className={cn(
            "focus-ring min-h-12 flex-1 rounded-md px-4 text-sm",
            dark ? "border border-ivory/15 bg-white/10 text-white placeholder:text-ivory/45" : "border border-saddle/20 bg-white text-ink"
          )}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          type="email"
          value={email}
        />
        <button
          className={cn(
            "focus-ring min-h-12 rounded-md px-6 text-sm font-bold uppercase tracking-[0.18em]",
            dark ? "bg-champagne text-ink hover:bg-ivory" : "bg-ink text-ivory hover:bg-saddle"
          )}
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Saving..." : buttonLabel}
        </button>
      </div>
      {message ? (
        <p className={cn("text-sm", status === "success" ? (dark ? "text-champagne" : "text-saddle") : "text-ember")}>{message}</p>
      ) : null}
    </form>
  );
}
