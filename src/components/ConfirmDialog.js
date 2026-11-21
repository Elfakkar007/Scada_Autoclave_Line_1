"use client";

/**
 * ConfirmDialog — Dialog konfirmasi aksi generik untuk seluruh aplikasi SCADA.
 *
 * Cara pakai:
 *   1. Bungkus layout dengan ConfirmDialogProvider (sudah dilakukan di layout.js)
 *   2. Di komponen mana pun:
 *        const confirm = useConfirm();
 *        const ok = await confirm({
 *          title: "...",
 *          description: "...",
 *          confirmText: "Hapus",
 *          cancelText: "Batalkan",
 *          variant: "danger",   // "danger" | "warning" | "default"
 *          children: <ReactNode>,  // opsional
 *          onConfirm: async () => { ... }, // opsional, untuk aksi async
 *        });
 *
 * Jika onConfirm disediakan, tombol konfirmasi menampilkan loading, kedua tombol
 * dinonaktifkan selama proses, dan error ditampilkan di dalam dialog jika gagal
 * (dialog tidak menutup otomatis saat gagal).
 *
 * Hanya satu dialog aktif pada satu waktu; pemanggilan berikutnya diantrikan.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ── Icons (inline SVG, tanpa dependensi eksternal) ────────────────────────────

function IconAlertTriangle({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconInfo({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Konfigurasi per variant ───────────────────────────────────────────────────

const VARIANT_CONFIG = {
  danger: {
    iconBg: "bg-scada-stop/10",
    iconColor: "text-scada-stop",
    confirmBtn:
      "bg-scada-stop hover:bg-scada-stop-hover focus-visible:ring-scada-stop",
    Icon: IconTrash,
    focusCancelFirst: true,
  },
  warning: {
    iconBg: "bg-scada-steam/10",
    iconColor: "text-scada-steam",
    confirmBtn:
      "bg-scada-steam hover:bg-scada-steam-hover focus-visible:ring-scada-steam",
    Icon: IconAlertTriangle,
    focusCancelFirst: false,
  },
  default: {
    iconBg: "bg-scada-water/10",
    iconColor: "text-scada-water",
    confirmBtn:
      "bg-scada-water hover:bg-scada-water-hover focus-visible:ring-scada-water",
    Icon: IconInfo,
    focusCancelFirst: false,
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

const ConfirmContext = createContext(null);

// ── Provider + Root Dialog ───────────────────────────────────────────────────

export function ConfirmDialogProvider({ children }) {
  const [dialogs, setDialogs] = useState([]); // antrian
  const [current, setCurrent] = useState(null); // dialog yang sedang tampil

  // Dequeue: saat current selesai, ambil antrian berikutnya
  const advance = useCallback(() => {
    setDialogs((prev) => {
      const [next, ...rest] = prev;
      if (next) setCurrent(next);
      else setCurrent(null);
      return rest;
    });
  }, []);

  const confirm = useCallback(
    (options) => {
      return new Promise((resolve) => {
        const entry = { ...options, resolve };
        setDialogs((prev) => {
          if (!current && prev.length === 0) {
            // Tidak ada dialog aktif → tampilkan langsung
            setCurrent(entry);
            return [];
          }
          return [...prev, entry];
        });
      });
    },
    [current]
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmDialogRoot
          key={current.resolve} // re-mount tiap dialog baru
          options={current}
          onClose={(result) => {
            current.resolve(result);
            advance();
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside ConfirmDialogProvider");
  }
  return ctx;
}

// ── Dialog UI ─────────────────────────────────────────────────────────────────

function ConfirmDialogRoot({ options, onClose }) {
  const {
    title,
    description,
    confirmText = "Konfirmasi",
    cancelText = "Batalkan",
    variant = "default",
    children,
    onConfirm,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.default;
  const { Icon, focusCancelFirst } = cfg;

  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  // Simpan elemen yang difokus sebelum dialog dibuka
  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      // Kembalikan fokus saat tutup
      triggerRef.current?.focus?.();
    };
  }, []);

  // Fokus awal
  useEffect(() => {
    const target = focusCancelFirst ? cancelRef.current : confirmRef.current;
    setTimeout(() => target?.focus(), 50);
  }, [focusCancelFirst]);

  // Kunci scroll body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function handleTab(e) {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    el.addEventListener("keydown", handleTab);
    return () => el.removeEventListener("keydown", handleTab);
  }, []);

  // Escape key
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape" && !loading) onClose(false);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [loading, onClose]);

  async function handleConfirm() {
    if (onConfirm) {
      setLoading(true);
      setError(null);
      try {
        await onConfirm();
        onClose(true);
      } catch (err) {
        setError(err?.message ?? "Terjadi kesalahan. Silakan coba lagi.");
        setLoading(false);
      }
    } else {
      onClose(true);
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !loading) onClose(false);
  }

  // Render via portal agar tidak terpotong overflow/z-index parent
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-scada-ink/50 backdrop-blur-[2px]"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      // Animasi: Tailwind animate-in memerlukan plugin; pakai style langsung
      style={{
        animation: "confirmFadeIn 150ms ease-out",
      }}
    >
      <div
        ref={dialogRef}
        className="bg-scada-card border border-scada-rule rounded-2xl shadow-xl w-full max-w-[450px] overflow-hidden"
        style={{
          animation: "confirmScaleIn 150ms ease-out",
        }}
        // Mencegah klik di dalam dialog memicu onOverlayClick
        onClick={(e) => e.stopPropagation()}
      >
        {/* Body */}
        <div className="p-6">
          {/* Ikon + Judul */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconBg}`}
            >
              <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
            </div>
            <div className="pt-0.5 min-w-0">
              <h2
                id="confirm-dialog-title"
                className="text-scada-ink font-semibold text-[18px] leading-snug"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="confirm-dialog-description"
                  className="text-scada-muted text-sm mt-2 leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Children (konten tambahan opsional) */}
          {children && (
            <div className="mt-4 mb-2">{children}</div>
          )}

          {/* Pesan error async */}
          {error && (
            <div className="mt-4 px-3 py-2.5 bg-scada-stop/10 border border-scada-stop/30 text-scada-stop rounded-lg text-sm flex items-start gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tombol */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onClose(false)}
              disabled={loading}
              className="px-4 py-2 bg-scada-card border border-scada-rule text-scada-ink hover:bg-scada-bg rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scada-rule focus-visible:ring-offset-2"
            >
              {cancelText}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center gap-2 ${cfg.confirmBtn}`}
            >
              {loading && (
                <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Memproses…" : confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe animations via style tag – tanpa plugin Tailwind */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes confirmFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes confirmScaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to   { opacity: 1; transform: scale(1); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes confirmFadeIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes confirmScaleIn { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
    </div>,
    document.body
  );
}
