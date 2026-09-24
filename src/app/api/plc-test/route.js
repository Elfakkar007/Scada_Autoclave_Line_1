/**
 * /api/plc-test — Endpoint KHUSUS TESTING koneksi ke KEPServerEX IoT Gateway.
 * Terpisah dari /api/status. Hanya untuk debugging — JANGAN dipakai di production.
 */

const DEFAULT_TAG_IDS = [
  "S7-200.SiemensS7-200.T1",
  "S7-200.SiemensS7-200.T2",
  "S7-200.SiemensS7-200.T3",
  "S7-200.SiemensS7-200.T4",
  "S7-200.SiemensS7-200.T5",
  "S7-200.SiemensS7-200.T6",
  "S7-200.SiemensS7-200.TH",
  "S7-200.SiemensS7-200.TM",
  "S7-200.SiemensS7-200.TL",
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Ambil tag IDs dari query param ?ids=tag1,tag2 atau pakai default
  const idsParam = searchParams.get("ids");
  const tagIds = idsParam
    ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : DEFAULT_TAG_IDS;

  // Ambil konfigurasi dari environment variables
  const protocol = process.env.IOT_GATEWAY_PROTOCOL || "http";
  const host     = process.env.IOT_GATEWAY_HOST;
  const port     = process.env.IOT_GATEWAY_PORT;
  const user     = process.env.IOT_GATEWAY_USER;
  const pass     = process.env.IOT_GATEWAY_PASS;

  // Validasi env vars wajib
  if (!host || !port || !user || !pass) {
    return Response.json(
      {
        ok: false,
        error:
          "Satu atau lebih environment variable tidak ditemukan: IOT_GATEWAY_HOST, IOT_GATEWAY_PORT, IOT_GATEWAY_USER, IOT_GATEWAY_PASS",
        hint: "Pastikan file .env.local sudah diisi dengan benar dan dev server sudah di-restart.",
      },
      { status: 500 }
    );
  }

  // Bangun URL: tiap tag di-append sebagai &ids=<encoded-tag>
  const baseUrl = `${protocol}://${host}:${port}/iotgateway/read`;
  const queryString = tagIds
    .map((id) => `ids=${encodeURIComponent(id)}`)
    .join("&");
  const requestedUrl = `${baseUrl}?${queryString}`;

  // Basic Auth header — password TIDAK masuk ke URL
  const basicAuth =
    "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  try {
    const response = await fetch(requestedUrl, {
      method: "GET",
      headers: {
        Authorization: basicAuth,
        Accept: "application/json",
      },
      // Tidak perlu trik bypass SSL karena protokol HTTP biasa
    });

    // Coba parse body sebagai JSON
    let raw;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      raw = await response.json();
    } else {
      // Kalau bukan JSON, kembalikan sebagai teks supaya tetap informatif
      const text = await response.text();
      return Response.json(
        {
          ok: false,
          error: `IoT Gateway merespons dengan Content-Type "${contentType}" (bukan JSON). HTTP status: ${response.status}`,
          rawText: text,
          requestedUrl,
          hint: "Cek apakah KEPServerEX IoT Gateway agent 'scada_autoclave' sedang berjalan, dan apakah IOT_GATEWAY_HOST/PORT di .env.local sudah benar",
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: `IoT Gateway mengembalikan HTTP ${response.status} ${response.statusText}`,
          raw,
          requestedUrl,
          hint: "Cek apakah KEPServerEX IoT Gateway agent 'scada_autoclave' sedang berjalan, dan apakah IOT_GATEWAY_HOST/PORT di .env.local sudah benar",
        },
        { status: 502 }
      );
    }

    // Sukses — kembalikan response IoT Gateway apa adanya
    return Response.json({
      ok: true,
      raw,
      requestedUrl,
      tagCount: tagIds.length,
    });
  } catch (err) {
    // Fetch gagal (network error, connection refused, dll)
    return Response.json(
      {
        ok: false,
        error: err?.message ?? String(err),
        requestedUrl,
        hint: "Cek apakah KEPServerEX IoT Gateway agent 'scada_autoclave' sedang berjalan, dan apakah IOT_GATEWAY_HOST/PORT di .env.local sudah benar",
      },
      { status: 503 }
    );
  }
}
