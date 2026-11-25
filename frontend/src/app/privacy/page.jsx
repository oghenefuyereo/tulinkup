import { LegalPage } from "@/components/LegalPage";
import { privacyPolicy } from "@/content/privacyPolicy";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Learn how TuLinkUp collects, uses, stores, and protects personal information.",
};

export default function PrivacyPage() {
  return <LegalPage {...privacyPolicy} />;
}
