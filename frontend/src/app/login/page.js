
import { AuthForm } from "@/components/AuthForm";

export const metadata = {
  title: "Login | TuLinkUp",
  description: "Log in to TuLinkUp to manage your learning journey.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
