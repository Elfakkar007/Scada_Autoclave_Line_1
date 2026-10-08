import "../globals.css";
import Navbar from "@/components/Navbar";
import AlarmCenter from "@/components/AlarmCenter";

export const metadata = {
  title: "SCADA Super Water Sterilizer",
  description: "Monitoring & kontrol mesin sterilizer",
};

// Layout ini berlaku untuk semua halaman KECUALI /login
// (login punya layout sendiri di app/(auth)/login/layout.js)
//
// Item 8b: AlarmCenter berada di atas area konten, di dalam alur layout (bukan overlay),
// sehingga tidak pernah menutupi tombol STOP. Hanya rute grup (app) yang memilikinya:
// /login dan /print/* tidak.
export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-scada-bg text-scada-ink">
      <Navbar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <AlarmCenter />
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}