import "../globals.css";
import Navbar from "@/components/Navbar";
import AlarmCenter from "@/components/AlarmCenter";
import ScreenLock from "@/components/ScreenLock";

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
//
// Item 14: ScreenLock mengunci interaksi layar setelah 7 menit pasif (inactivity timeout),
// menampilkan overlay transparan dan meminta verifikasi password saat layar diklik.
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
      <ScreenLock />
    </div>
  );
}