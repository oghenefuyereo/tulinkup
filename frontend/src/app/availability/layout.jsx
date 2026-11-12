
// Set the page information for the tutor availability section.
export const metadata = {
  // Define the title displayed in the browser tab.
  title: "Tutor Availability",

  // Describe the purpose of the availability page.
  description: "Manage your tutoring availability on TuLinkUp.",

  // Prevent search engines from indexing or following links on this page.
  robots: {
    index: false,
    follow: false,
  },
};

// Create the layout for the tutor availability page.
export default function AvailabilityLayout({ children }) {
  // Display the page content inside this layout.
  return children;
}
