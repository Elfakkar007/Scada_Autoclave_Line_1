"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/StatCard";
import Link from "next/link";

export default function Home() {
  const [data, setData] = useState(null);
  const [stopping, setStopping] = useState(false);
  const router = useRouter();

  async function fetchData() {
    const res = await fetch("/api/status");
    const json = await res.json();
    setData(json);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleStop() {
    if (!window.confirm(`Yakin ingin menghentikan batch ${data.batchNo}?`)) return;
    setStopping(true);
    try {
      await fetch("/api/batch/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: data.operator ?? "unknown" }),
      });
      await fetchData();
    } finally {
      setStopping(false);
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 p-8">
        Memuat data...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-8">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Super Water Sterilizer — Monitoring
        </h1>
        {!data.running && (
          <Link
            href="/prepare"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-semibold transition-colors"
          >
            + Mulai Batch Baru
          </Link>
        )}
      </div>

      {/* ── Status Proses ── */}
      <div className="mb-6">
        <span className="text-sm text-slate-400 mr-2">Status Proses:</span>
        <span className="px-3 py-1 rounded-md bg-blue-600 font-semibold">
          {data.status}
        </span>
      </div>

      {/* ── Info Batch Aktif (hanya tampil saat running) ── */}
      {data.running && data.batchNo && (
        <div className="mb-6 bg-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-slate-400 uppercase">Batch No</p>
              <p className="font-mono font-bold text-lg">{data.batchNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Operator</p>
              <p className="font-semibold">{data.operator}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Produk</p>
              <p className="font-semibold">{data.productName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Formula</p>
              <p className="font-mono font-semibold">{data.formulaNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Mulai</p>
              <p className="text-sm">
                {data.runBegin
                  ? new Date(data.runBegin).toLocaleString("id-ID")
                  : "-"}
              </p>
            </div>
          </div>
          <button
            onClick={handleStop}
            disabled={stopping}
            className="shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-semibold transition-colors"
          >
            {stopping ? "Menghentikan…" : "⏹ Selesai / Stop"}
          </button>
        </div>
      )}

      {/* ── Sensor T1–T6 ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <StatCard label="T1" value={data.t1} unit="°C" />
        <StatCard label="T2" value={data.t2} unit="°C" />
        <StatCard label="T3" value={data.t3} unit="°C" />
        <StatCard label="T4" value={data.t4} unit="°C" />
        <StatCard label="T5" value={data.t5} unit="°C" />
        <StatCard label="T6" value={data.t6} unit="°C" />
      </div>

      {/* ── Sensor TH/TM/TL ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="TH" value={data.th} unit="°C" />
        <StatCard label="TM" value={data.tm} unit="°C" />
        <StatCard label="TL" value={data.tl} unit="°C" />
      </div>

      {/* ── Indikator running / update terakhir ── */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-3 h-3 rounded-full ${data.running ? "bg-green-400" : "bg-red-500"}`}
        />
        <span className="text-sm">
          {data.running ? "Mesin berjalan" : "Mesin berhenti"}
        </span>
      </div>

      <div className="text-xs text-slate-500">
        Update terakhir: {new Date(data.updatedAt).toLocaleTimeString("id-ID")}
      </div>
    </main>
  );
}