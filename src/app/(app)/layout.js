import "../globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "SCADA Super Water Sterilizer",
  description: "Monitoring & kontrol mesin sterilizer",
};

// Layout ini berlaku untuk semua halaman KECUALI /login
// (login punya layout sendiri di app/(auth)/login/layout.js)
export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-scada-bg text-scada-ink">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
