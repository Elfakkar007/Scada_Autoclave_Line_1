-- ==============================================================================
-- Migrasi item17b: Master Nama Produk & Master Spesifikasi Kemasan
-- SCADA Super Water Sterilizer
-- ==============================================================================

-- 1. Tabel Master Nama Produk (product_names)
CREATE TABLE IF NOT EXISTS product_names (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_names_name_uniq 
    ON product_names (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS product_names_active_idx 
    ON product_names (is_active);

-- Seed data awal nama produk
INSERT INTO product_names (name, is_active)
VALUES
    ('Ringer Lactate', true),
    ('Sodium Chloride 0.9%', true),
    ('Dextrose 5%', true),
    ('Water For Injection', true),
    ('Paracetamol Infus', true)
ON CONFLICT DO NOTHING;

-- 2. Tabel Master Spesifikasi Kemasan (product_specs)
CREATE TABLE IF NOT EXISTS product_specs (
    id SERIAL PRIMARY KEY,
    spec VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_specs_spec_uniq 
    ON product_specs (lower(btrim(spec)));

CREATE INDEX IF NOT EXISTS product_specs_active_idx 
    ON product_specs (is_active);

-- Seed data awal spesifikasi kemasan
INSERT INTO product_specs (spec, is_active)
VALUES
    ('500 ml Soft Bag', true),
    ('1000 ml Bottle', true),
    ('100 ml Soft Bag', true),
    ('250 ml Bottle', true),
    ('N/A', true)
ON CONFLICT DO NOTHING;
