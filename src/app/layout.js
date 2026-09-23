import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "SCADA Super Water Sterilizer",
  description: "Monitoring & kontrol mesin sterilizer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}