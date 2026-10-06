import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // SEMENTARA: aturan baru react-hooks (Next 16) ini menandai pola "panggil fungsi
  // fetch di dalam useEffect" yang dipakai di ~10 halaman. Diturunkan ke warning
  // supaya `npm run lint` tidak gagal karena kode lama. Dibereskan di item roadmap
  // tersendiri ("Bersihkan lint"); setelah itu hapus override ini.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
