import { LegalPage } from "@/components/LegalPage";
import { termsOfService } from "@/content/termsOfService";

export const metadata = {
  title: "Terms of Service",
  description:
    "Learn about TuLinkUp platform rules, tutoring services, payments, and user responsibilities.",
};

export default function TermsPage() {
  return <LegalPage {...termsOfService} />;
}
