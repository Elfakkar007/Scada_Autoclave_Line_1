"use client";

// Kerangka modal sederhana untuk popup konfirmasi tulis ke PLC.
export default function PlcDialog({ title, wide = false, children }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className={`bg-scada-card border border-scada-rule rounded-lg shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}
            >
                <div className="px-5 py-3 border-b border-scada-rule font-semibold text-scada-ink">{title}</div>
                <div className="p-5 text-sm text-scada-ink">{children}</div>
            </div>
        </div>
    );
}
