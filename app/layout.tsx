import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "PastoFlux — Gestão inteligente da fazenda";
const ICON_VERSION = 2;
const description ="Gerencie rebanho, pastagens, alertas, simulações e aluguel em uma única visão.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title, description,
    // ?v= força os navegadores a buscar o ícone novo (eles guardam favicons por muito tempo).
    // Ao trocar o ícone de novo, aumente ICON_VERSION.
    icons: {
      icon: [
        { url: `/favicon.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
        { url: `/favicon-32.png?v=${ICON_VERSION}`, sizes: "32x32", type: "image/png" },
      ],
      shortcut: `/favicon.ico?v=${ICON_VERSION}`,
      apple: { url: `/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180" },
    },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: "PastoFlux — gestão inteligente da fazenda" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
