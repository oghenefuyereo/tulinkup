
// Import the authentication form used for login and registration.
import { AuthForm } from "@/components/AuthForm";

// Set the page title and description for the login page.
export const metadata = {
  title: "Login | TuLinkUp",
  description: "Log in to TuLinkUp to manage your learning journey.",
};

// Create the login page for TuLinkUp users.
export default function LoginPage() {
  // Display the authentication form in login mode.
  return <AuthForm mode="login" />;
}
