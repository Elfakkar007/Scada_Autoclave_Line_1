-- =============================================================================
-- Rollback migrasi 005: pulihkan users.role, CHECK, fungsi, dan trigger lama.
-- Definisi di bawah disalin dari DB scada-atv1 (pg_get_functiondef, pg_get_constraintdef,
-- information_schema.columns) pada 27 Okt 2026, SEBELUM 005 dijalankan.
-- Jalankan HANYA bila 005 sudah dijalankan. Backup DB dulu.
-- Catatan: kolom role dikembalikan di posisi TERAKHIR tabel (urutan kolom bukan yang asli);
--          nilainya dihitung ulang dari role_id dengan aturan yang sama dengan trigger lama.
-- =============================================================================
BEGIN;

-- Pastikan 005 memang sudah dijalankan
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_attribute
                WHERE attrelid = 'public.users'::regclass AND attname = 'role' AND NOT attisdropped) THEN
        RAISE EXCEPTION 'Rollback dibatalkan: kolom users.role sudah ada (005 belum dijalankan?)';
    END IF;
END;
$$;

-- 1. Kolom (baris lama otomatis berisi default 'operator')
ALTER TABLE public.users ADD COLUMN role text NOT NULL DEFAULT 'operator';

-- 2. Isi ulang: key role 'admin' -> 'admin', selain itu (termasuk role_id NULL) -> 'operator'
UPDATE public.users u
   SET role = 'admin'
  FROM public.roles r
 WHERE r.id = u.role_id AND r.key = 'admin';

-- 3. CHECK asli
ALTER TABLE public.users
    ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['operator'::text, 'admin'::text])));

-- 4. Fungsi trigger asli (versi DB, termasuk "IF FOUND AND ...")
CREATE OR REPLACE FUNCTION public.trg_users_sync_legacy_role_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_role_key TEXT;
BEGIN
  IF NEW.role_id IS NULL THEN
    NEW.role := 'operator';
  ELSE
    SELECT key INTO v_role_key FROM roles WHERE id = NEW.role_id;
    IF FOUND AND v_role_key = 'admin' THEN
      NEW.role := 'admin';
    ELSE
      NEW.role := 'operator';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Fungsi yatim dari 002 (dipulihkan agar rollback setia pada keadaan sebelum 005)
CREATE OR REPLACE FUNCTION public.users_sync_legacy_role()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  SELECT CASE WHEN r.key = 'admin' THEN 'admin' ELSE 'operator' END
    INTO NEW.role
    FROM public.roles r WHERE r.id = NEW.role_id;
  RETURN NEW;
END;
$function$;

-- 6. Trigger asli
CREATE TRIGGER trg_users_sync_legacy_role
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.trg_users_sync_legacy_role_fn();

COMMIT;
