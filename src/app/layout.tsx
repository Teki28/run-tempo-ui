import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Auth0ProviderWrapper } from "@/components/Auth0Provider";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Run Pulse",
  description: "Run With YAn app that overlays a customizable BPM tempo track onto your favorite music to match your running pace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Auth0ProviderWrapper>
          <UserProfileProvider>
            {children}
          </UserProfileProvider>
        </Auth0ProviderWrapper>
      </body>
    </html>
  );
}
