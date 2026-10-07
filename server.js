/**
 * server.js — Custom server Next.js dengan background trend recorder.
 *
 * MENGAPA CUSTOM SERVER?
 * Next.js default (next dev / next start) tidak punya tempat untuk proses
 * background yang persisten. Kalau trend recorder dijalankan di dalam
 * route handler, ia hanya aktif saat ada request masuk — tidak cocok untuk
 * perekaman data yang harus berjalan terus walaupun dashboard tidak dibuka.
 *
 * MENGAPA CJS + dynamic import()?
 * - Proyek ini TIDAK punya "type":"module" di package.json (dan tidak boleh
 *   ditambahkan sembarangan karena akan merusak next.config.js, postcss.config.js,
 *   dll yang sudah pakai CommonJS).
 * - Tapi src/lib/trendRecorder.js ditulis ESM (import/export) karena juga
 *   dipakai oleh Next.js App Router yang selalu ESM.
 * - Solusi paling stabil di Next.js 15: server.js pakai CJS, lalu load modul
 *   ESM via dynamic import() yang mengembalikan Promise. Ini fitur resmi Node.js
 *   (interop CJS-ESM), tidak butuh transpiler tambahan.
 *
 * CARA MENJALANKAN:
 *   Development : npm run dev         (= node server.js)
 *   Production  : npm run build && npm start  (= NODE_ENV=production node server.js)
 */

"use strict";

const { createServer } = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3001", 10);

const POLL_INTERVAL_MS = 5_000; // 5 detik — tick sering; keputusan INSERT ada di recordTrendTick

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Load trendRecorder via dynamic import() karena file tersebut ESM.
    // Dynamic import() adalah cara resmi Node.js untuk load ESM dari CJS.
    const { recordTrendTick } = await import("./src/lib/trendRecorder.js");

    createServer(async (req, res) => {
        try {
            // Item 7: tentukan IP klien di SINI, dari alamat koneksi sebenarnya, lalu
            // teruskan lewat header x-client-ip. Header dari klien SELALU ditimpa,
            // jadi tidak bisa dipalsukan. Dipakai untuk audit_log dan batas login.
            // Bila di depan server ada reverse proxy tepercaya, set TRUST_PROXY=true
            // agar IP diambil dari entri pertama x-forwarded-for.
            let clientIp = req.socket?.remoteAddress || "unknown";
            if (process.env.TRUST_PROXY === "true") {
                const xff = req.headers["x-forwarded-for"];
                const first = typeof xff === "string" ? xff.split(",")[0].trim() : "";
                if (first) clientIp = first;
            }
            req.headers["x-client-ip"] = clientIp.replace(/^::ffff:/, "");

            await handle(req, res);
        } catch (err) {
            console.error("[server] Error menangani request:", err);
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`> Server siap di http://${hostname}:${port}`);
        console.log(`> Mode: ${dev ? "development" : "production"}`);

        // Jalankan trend recorder pertama kali 10 detik setelah server siap
        // (beri waktu DB & PLC connection pool settle dulu).
        setTimeout(() => {
            recordTrendTick(); // tick pertama langsung

            setInterval(() => {
                recordTrendTick();
            }, POLL_INTERVAL_MS);

            console.log(
                `> Trend recorder berjalan, poll interval ${POLL_INTERVAL_MS / 1000} detik`
            );
        }, 10_000);
    });
});