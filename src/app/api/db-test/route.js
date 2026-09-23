import pool from "@/lib/db";

export async function GET() {
    try {
        // Query 1: Cek waktu saat ini (memastikan koneksi dasar jalan)
        const timeResult = await pool.query("SELECT NOW() as current_time");
        
        // Query 2: Menghitung jumlah baris di tabel "tags" (memastikan tabel sudah ada & bisa dibaca)
        const countResult = await pool.query("SELECT COUNT(*) FROM tags");

        return Response.json({
            ok: true,
            time: timeResult.rows[0].current_time,
            tagCount: parseInt(countResult.rows[0].count, 10) // count biasanya me-return string '0' dari postgres
        });
    } catch (error) {
        console.error("Database connection error:", error);
        return Response.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
