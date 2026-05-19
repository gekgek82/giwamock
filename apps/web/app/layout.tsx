import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "@/context/ClientProviders";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "GiwaTer | Giwa DEX",
    template: "%s | GiwaTer",
  },
  description:
    "Swap, provide liquidity, and earn rewards on GiwaTer — the DEX built on Giwa Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css"
        />
      </head>
      <body className="antialiased min-h-screen">
        <ErrorBoundary>
          <ClientProviders>{children}</ClientProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
