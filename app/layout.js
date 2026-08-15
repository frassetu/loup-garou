import "./globals.css";

export const metadata = {
  title: "Loup-Garou",
  description: "Distribution des rôles pour vos parties de Loup-Garou",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1120",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
