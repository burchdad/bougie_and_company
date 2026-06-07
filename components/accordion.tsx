"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

type AccordionProps = {
  items: Array<[string, string]>;
};

export function Accordion({ items }: AccordionProps) {
  const [open, setOpen] = useState(0);

  return (
    <div className="divide-y divide-saddle/15 overflow-hidden rounded-lg border border-saddle/15 bg-ivory shadow-luxe">
      {items.map(([title, body], index) => (
        <div key={title}>
          <button
            className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-espresso"
            onClick={() => setOpen(open === index ? -1 : index)}
            type="button"
          >
            <span>{title}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 transition ${open === index ? "rotate-180" : ""}`} />
          </button>
          {open === index ? <p className="px-5 pb-5 text-sm leading-7 text-espresso/75">{body}</p> : null}
        </div>
      ))}
    </div>
  );
}
