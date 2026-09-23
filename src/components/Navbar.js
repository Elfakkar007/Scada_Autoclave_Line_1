import Link from "next/link";

const menu = [
    { href: "/", label: "Dashboard" },
    { href: "/data-report", label: "Data Report" },
    { href: "/trend", label: "Trend" },
    { href: "/alarm", label: "Alarm" },
    { href: "/formula", label: "Formula" },
];

export default function Navbar() {
    return (
        <nav className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex gap-6">
            {menu.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm text-slate-300 hover:text-white font-medium"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}