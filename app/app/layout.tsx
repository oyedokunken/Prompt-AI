import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/ThemeProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://prompt.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Prompt AI - Structured prompts from plain language",
    template: "%s | Prompt AI",
  },
  description:
    "Prompt AI takes vague instructions and constructs detailed, structured prompts optimized for the AI model or tool you're targeting.",
  keywords: [
    "AI prompts",
    "prompt engineering",
    "structured prompts",
    "prompt generator",
    "LLM prompts",
  ],
  openGraph: {
    title: "Prompt AI",
    description: "Structured prompts from plain language.",
    type: "website",
    url: "/",
    siteName: "Prompt AI",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Prompt AI - Structured prompts from plain language",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt AI",
    description: "Structured prompts from plain language.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must run before any stylesheet or app script so the correct
            theme class is on <html> before first paint. A useEffect runs
            after first paint and would not prevent the flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
