
import Link from "next/link";
import { Footer } from "@/components/Footer";

const subjects = [
  { id: 1, name: "Mathematics", slug: "mathematics", icon: "∑" },
  { id: 2, name: "Programming", slug: "programming", icon: "</>" },
  { id: 3, name: "English", slug: "english", icon: "Aa" },
  { id: 4, name: "Chemistry", slug: "chemistry", icon: "⚗" },
  { id: 5, name: "Physics", slug: "physics", icon: "Φ" },
  { id: 6, name: "Biology", slug: "biology", icon: "DNA" },
  {
    id: 7,
    name: "Graphic Design",
    slug: "graphic-design",
    icon: "◇",
  },
];

const steps = [
  {
    number: "01",
    icon: "⌕",
    title: "Discover your match",
    description:
      "Search trusted tutors by subject, price, rating and availability.",
  },
  {
    number: "02",
    icon: "▦",
    title: "Choose a time",
    description:
      "Open a tutor profile and select an available session that works for you.",
  },
  {
    number: "03",
    icon: "✓",
    title: "Start learning",
    description:
      "Send your request, get confirmed, and arrive ready to make progress.",
  },
];

const testimonials = [
  {
    quote:
      "Florence made calculus feel manageable and gave me a plan I could actually follow.",
    name: "Maya J.",
    role: "Grade 12 student",
  },
  {
    quote:
      "I found the right coding mentor in one evening. The booking flow was so clear.",
    name: "Daniel K.",
    role: "Career switcher",
  },
  {
    quote:
      "TuLinkUp gives me a professional way to organise requests and protect my teaching time.",
    name: "Amina R.",
    role: "English tutor",
  },
];

export default function HomePage() {
  return (
    <>
      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-[#f7f9fd] py-14 sm:py-20 lg:py-24">
          <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-[#f5c518]/10" />

          <div className="page-wrap relative grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe4f5] bg-white px-4 py-2 text-xs font-extrabold text-[#26469b] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#25ad61]" />
                Trusted tutors, real progress
              </span>

              <h1 className="mt-6 max-w-2xl text-[42px] font-extrabold leading-[1.06] tracking-[-.055em] text-[#17233d] sm:text-6xl">
                Find the right tutor.{" "}
                <span className="text-[#26469b]">
                  Reach your learning goals.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[#68758c] sm:text-lg">
                TuLinkUp connects you with qualified, verified
                tutors for focused one-to-one learning that fits
                your goals and schedule.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tutors"
                  className="btn-primary gap-2 px-7 py-4"
                >
                  Find a tutor →
                </Link>

                <Link
                  href="/register?role=tutor"
                  className="btn-secondary px-7 py-4"
                >
                  Become a tutor
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#56627a]">
                <span>✓ Verified profiles</span>
                <span>✓ Flexible scheduling</span>
                <span>✓ No payment required yet</span>
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/4.2] overflow-hidden rounded-[36px] border-[10px] border-white bg-[#dfe6f3] shadow-[0_30px_80px_rgba(23,52,114,.18)]">
                <div className="flex h-full items-center justify-center px-8 text-center">
                  <div>
                    <div className="text-6xl">📚</div>
                    <p className="mt-5 text-2xl font-extrabold text-[#173472]">
                      Learn. Practice. Build.
                    </p>
                    <p className="mt-2 font-semibold text-[#68758c]">
                      Connect. Grow.
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-4 rounded-2xl border border-white bg-white p-4 shadow-xl sm:-left-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f8ef] text-[#25ad61]">
                    ↗
                  </span>

                  <div>
                    <p className="text-xs font-semibold text-[#7a8599]">
                      Student progress
                    </p>
                    <p className="text-lg font-extrabold text-[#17233d]">
                      Goals achieved
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-20 sm:py-24">
          <div className="page-wrap">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Simple by design</p>

              <h2 className="section-title mt-3">
                Your next breakthrough is three steps away
              </h2>

              <p className="mt-4 text-[#68758c]">
                From discovery to your first session in minutes.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="panel relative p-7"
                >
                  <span className="absolute right-6 top-5 text-5xl font-black text-[#eef1f7]">
                    {step.number}
                  </span>

                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf1fa] text-2xl text-[#26469b]">
                    {step.icon}
                  </span>

                  <h3 className="mt-6 text-xl font-bold">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-[#68758c]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* POPULAR SUBJECTS */}
        <section
          id="subjects"
          className="bg-[#f7f9fd] py-20"
        >
          <div className="page-wrap">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">
                  Explore what interests you
                </p>

                <h2 className="section-title mt-3">
                  Popular subjects
                </h2>
              </div>

              <Link
                href="/tutors"
                className="font-bold text-[#26469b]"
              >
                View all tutors →
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/tutors?subject=${subject.slug}`}
                  className="group rounded-2xl border border-[#e4e9f1] bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-[#aab9dd]"
                >
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#edf1fa] text-sm font-black text-[#26469b] group-hover:bg-[#26469b] group-hover:text-white">
                    {subject.icon}
                  </span>

                  <span className="mt-4 block text-sm font-bold text-[#25324c]">
                    {subject.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURED TUTORS */}
        <section className="py-20 sm:py-24">
          <div className="page-wrap">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow">
                  Learn from the best
                </p>

                <h2 className="section-title mt-3">
                  Featured tutors
                </h2>
              </div>

              <Link
                href="/tutors"
                className="hidden font-bold text-[#26469b] sm:block"
              >
                Browse marketplace →
              </Link>
            </div>

            <div className="panel mt-10 p-10 text-center text-[#68758c]">
              Tutor profiles will appear here once they
              are published.
            </div>
          </div>
        </section>

        {/* STUDENTS AND TUTORS */}
        <section className="bg-[#173472] py-20 text-white">
          <div className="page-wrap grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f5c518]">
                Built for every side of learning
              </p>

              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">
                Confidence for students. Opportunity
                for tutors.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/8 p-6">
                <h3 className="text-lg font-bold">
                  For students
                </h3>

                <ul className="mt-4 space-y-3 text-sm text-blue-100/80">
                  <li>✓ Expert help without guesswork</li>
                  <li>✓ Flexible one-to-one sessions</li>
                  <li>✓ Clear booking status</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/8 p-6">
                <h3 className="text-lg font-bold">
                  For tutors
                </h3>

                <ul className="mt-4 space-y-3 text-sm text-blue-100/80">
                  <li>✓ A professional tutor profile</li>
                  <li>✓ Control over your availability</li>
                  <li>✓ Simple booking management</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="py-20">
          <div className="page-wrap">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">
                Sample success stories
              </p>

              <h2 className="section-title mt-3">
                Learners move forward here
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((item) => (
                <blockquote
                  key={item.name}
                  className="panel p-7"
                >
                  <div className="flex gap-1 text-[#f5c518]">
                    ★★★★★
                  </div>

                  <p className="mt-5 leading-7 text-[#3e4a61]">
                    “{item.quote}”
                  </p>

                  <footer className="mt-6 border-t border-[#edf0f5] pt-4">
                    <p className="font-bold">
                      {item.name}
                    </p>

                    <p className="text-sm text-[#7a8599]">
                      {item.role}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-[#f5c518] px-6 py-12 text-center sm:px-12">
            <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#17233d]">
              Ready to make your next lesson count?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-[#4b4d46]">
              Join TuLinkUp and connect with the right
              learning partner today.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/tutors"
                className="btn-primary px-7"
              >
                Find your tutor
              </Link>

              <Link
                href="/register?role=tutor"
                className="rounded-xl border border-[#17233d]/20 bg-white px-7 py-3 text-sm font-bold text-[#17233d]"
              >
                Start tutoring
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
