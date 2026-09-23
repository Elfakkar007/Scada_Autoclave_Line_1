// scripts/hash-password.js
// ─────────────────────────────────────────────────────────
// Script Node.js untuk generate bcrypt hash dari password.
// Jalankan manual lewat terminal:
//   node scripts/hash-password.js "passwordnya"
// ─────────────────────────────────────────────────────────

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
    console.error("Usage: node scripts/hash-password.js <password>");
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

console.log("");
console.log("Password hash:");
console.log(hash);
console.log("");
console.log("Copy hash di atas, lalu jalankan query INSERT berikut di pgAdmin:");
console.log(`INSERT INTO users (username, password_hash, full_name, role) VALUES ('USERNAME_DISINI', '${hash}', 'NAMA_LENGKAP_DISINI', 'admin');`);
console.log("");
