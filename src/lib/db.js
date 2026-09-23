// ==============================================================================
// PERHATIAN: File ini adalah SERVER-ONLY (Hanya boleh dipanggil di sisi Server).
// JANGAN meng-import file ini ke dalam komponen React yang memiliki arahan "use client"
// di bagian atas, karena akan menyebabkan error (package 'pg' butuh environment Node.js).
// ==============================================================================

import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export default pool;
