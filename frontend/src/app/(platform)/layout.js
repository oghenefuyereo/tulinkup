import PlatformLayout from "@/components/feed/PlatformLayout";

export const dynamic = "force-dynamic";

export default function Layout({ children }) {
  return <PlatformLayout>{children}</PlatformLayout>;
}
