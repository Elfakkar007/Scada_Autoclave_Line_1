import "./globals.css";

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
      <body>
        {children}
      </body>
    </html>
  );
}