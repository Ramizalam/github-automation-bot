import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Automation Bot",
  description: "Automate your GitHub workflow seamlessly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-50 min-h-screen font-sans antialiased selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
