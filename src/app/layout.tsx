import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Case Room",
  description:
    "Volunteers with different expertise and AI work together on one cancer case, building a brief of questions and options for the patient's own doctor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
