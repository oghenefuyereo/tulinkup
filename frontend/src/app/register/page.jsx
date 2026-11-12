
// Import the authentication form used for login and registration.
import { AuthForm } from "@/components/AuthForm";

// Create the registration page for new students and tutors.
export default async function RegisterPage({ searchParams }) {
  // Read the account role from the page's URL parameters.
  const { role } = await searchParams;

  // Display the registration form with the appropriate account type.
  return (
    <AuthForm
      // Set the form to registration mode.
      mode="register"

      // Select tutor if requested, otherwise default to student.
      initialRole={role === "tutor" ? "tutor" : "student"}
    />
  );
}
