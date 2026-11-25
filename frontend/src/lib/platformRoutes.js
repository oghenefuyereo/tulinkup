// Define pages that use the shared TuLinkUp platform layout.
export function isPlatformRoute(pathname) {
  if (typeof pathname !== "string") {
    return false;
  }

  // Display the shared layout on the homepage.
  if (pathname === "/") {
    return true;
  }

  // Keep booking and payment pages focused.
  if (
    /^\/tutors\/[^/]+\/book(?:\/|$)/.test(pathname)
  ) {
    return false;
  }

  // Define the main educational platform sections.
  const routes = [
    "/tutors",
    "/group-classes",
    "/courses",
    "/messages",
    "/saved",
    "/profile",
  ];

  return routes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(route + "/")
  );
}

// Determine whether a navigation item is active.
export function isPlatformLinkActive(pathname, href) {
  if (!href || typeof pathname !== "string") {
    return false;
  }

  return (
    pathname === href ||
    (href !== "/" && pathname.startsWith(href + "/"))
  );
}
