"use client";

import { useId, useState } from "react";

export default function TutorProfileSections({ sections }) {

  const [active, setActive] = useState("About");

  const panelId = useId();

  const selected =
    sections.find(
      (section) => section.label === active
    ) || sections[0];

  return (
    <section className="panel min-w-0 overflow-hidden">

      <nav
        aria-label="Tutor profile sections"
        className="flex overflow-x-auto border-b border-[#e5e9f0] px-3"
      >

        {sections.map((section) => (

          <button
            key={section.label}
            type="button"
            aria-pressed={
              selected.label === section.label
            }
            aria-controls={panelId}
            onClick={() => setActive(section.label)}
            className={`shrink-0 whitespace-nowrap border-b-[3px] px-4 py-4 text-sm font-semibold ${
              selected.label === section.label
                ? "border-[#26469b] text-[#26469b]"
                : "border-transparent text-[#68758c] hover:text-[#26469b]"
            }`}
          >

            {section.label}

            {section.soon && (
              <span className="ml-1 text-[10px] text-[#9f7500]">
                Soon
              </span>
            )}

          </button>

        ))}

      </nav>

      <div id={panelId} className="p-5 sm:p-7">

        {selected.content}

      </div>

    </section>
  );
}
