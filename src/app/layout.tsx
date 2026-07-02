import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smile Passport — Your Smile, Verified",
  description: "Capture your smile, receive expert dental insights within 24 hours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
