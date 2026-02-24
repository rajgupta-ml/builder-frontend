import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ReliabilityProvider } from "@/components/providers/ReliabilityProvider";

export const metadata: Metadata = {
  title: "AIM",
  description: "Survey Builder for AIM",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ReliabilityProvider>{children}</ReliabilityProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
