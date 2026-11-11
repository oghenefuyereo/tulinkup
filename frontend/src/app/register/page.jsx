
import { AuthForm } from "@/components/AuthForm";

export default async function RegisterPage({ searchParams }) {
  const { role } = await searchParams;

  return (
    <AuthForm
      mode="register"
      initialRole={role === "tutor" ? "tutor" : "student"}
    />
  );
}
