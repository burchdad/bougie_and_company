import type { Metadata } from "next";
import { Facebook, Instagram, Mail, MapPin, Music2 } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Bougie & Company Boutique in Rusk, Texas for boutique shopping, product questions, and customer support."
};

export default function ContactPage() {
  return (
    <section className="sunset-band px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Contact</p>
          <h1 className="mt-4 font-display text-5xl text-ink sm:text-6xl">We would love to hear from you.</h1>
          <div className="mt-8 grid gap-4 text-espresso/75">
            <p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-saddle" /> Rusk, Texas</p>
            <p className="flex items-center gap-3"><Mail className="h-5 w-5 text-saddle" /> info@bougieandcompany</p>
          </div>
          <div className="mt-8 flex gap-3">
            {[Facebook, Instagram, Music2].map((Icon, index) => (
              <a className="focus-ring rounded-full border border-saddle/20 bg-white p-3 text-saddle hover:bg-cream" href="#" key={index} aria-label="Social link">
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
