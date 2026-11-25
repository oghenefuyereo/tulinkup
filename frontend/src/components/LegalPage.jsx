import Link from "next/link";
import { Footer } from "./Footer";

// Shared layout for TuLinkUp legal documents.
export function LegalPage({
  title,
  version,
  updatedAt,
  sections,
}) {
  return (
    <>
      <main className="min-h-screen bg-[#f7f9fd] px-5 py-12 md:py-20">
        <article className="mx-auto max-w-4xl rounded-2xl border border-[#edf0f5] bg-white p-6 md:p-12">

          <Link
            href="/"
            className="text-sm font-bold text-[#26469b]"
          >
            Back to TuLinkUp
          </Link>

          <header className="mb-10 mt-6 border-b border-[#edf0f5] pb-8">
            <p className="text-sm font-bold uppercase tracking-wider text-[#26469b]">
              TuLinkUp Legal
            </p>

            <h1 className="mt-3 text-3xl font-extrabold md:text-5xl">
              {title}
            </h1>

            <p className="mt-4 text-sm text-[#68758c]">
              Version: {version}
            </p>

            <p className="mt-1 text-sm text-[#68758c]">
              Last updated: {updatedAt}
            </p>

            <p className="mt-1 text-sm text-[#68758c]">
              Operated by Inovenatic Group
            </p>
          </header>

          <nav
            aria-label="Table of contents"
            className="mb-10 rounded-xl bg-[#f7f9fd] p-5"
          >
            <h2 className="mb-4 font-extrabold">
              Table of contents
            </h2>

            <ol className="space-y-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-[#26469b] hover:underline"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-10">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28"
              >
                <h2 className="mb-4 text-xl font-extrabold md:text-2xl">
                  {index + 1}. {section.title}
                </h2>

                {section.paragraphs?.map((paragraph, i) => (
                  <p
                    key={i}
                    className="mb-4 leading-7 text-[#5a6780]"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.items?.length > 0 && (
                  <ul className="list-disc space-y-2 pl-6 leading-7 text-[#5a6780]">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-[#edf0f5] pt-6">
            <div className="flex flex-wrap gap-6 text-sm font-bold text-[#26469b]">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
