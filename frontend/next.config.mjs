/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "czlhnjdagetbgbzwrjmc.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/profile-images/**",
        search: "",
      },
    ],
  },

  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
