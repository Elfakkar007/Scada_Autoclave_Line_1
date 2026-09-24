import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "SCADA Super Water Sterilizer",
  description: "Monitoring & kontrol mesin sterilizer",
};

// Root layout: hanya menyediakan <html> dan <body>.
// Navbar dirender oleh src/app/(app)/layout.js khusus untuk rute yang membutuhkannya.
// Halaman /login menggunakan layout sendiri tanpa Navbar.
export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body
        className={`${plexSans.variable} ${plexMono.variable} font-[family-name:var(--font-plex-sans)]`}
      >
        {children}
      </body>
    </html>
  );
}