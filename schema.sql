-- ===================================================================
--  Struktura databáze (Cloudflare D1 = SQLite)
--
--  Spuštění lokálně:   npx wrangler d1 execute ugustiku --local --file=schema.sql
--  Spuštění na webu:   npx wrangler d1 execute ugustiku --remote --file=schema.sql
--
--  Soubor se dá pustit opakovaně – všechno je "IF NOT EXISTS",
--  takže existující data nesmaže.
-- ===================================================================


-- -------------------------------------------------------------------
--  Týden je základní jednotka. Vybírá se, kopíruje a zveřejňuje jako
--  celek, proto má vlastní tabulku. Klíčem je datum pondělí ve tvaru
--  'YYYY-MM-DD' – z něj se spočítá všechno ostatní.
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tydny (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pondeli       TEXT    NOT NULL UNIQUE,          -- '2026-11-02'
  zverejneno    INTEGER NOT NULL DEFAULT 0,       -- 0 = koncept, 1 = veřejné
  zverejneno_v  TEXT,                             -- kdy se zveřejnilo poprvé
  upraveno_v    TEXT    NOT NULL DEFAULT (datetime('now'))
);


-- -------------------------------------------------------------------
--  Jeden den v týdnu, 1 = pondělí až 5 = pátek.
--  Zavřený den si nese poznámku, např. „Státní svátek – zavřeno“.
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dny (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tyden_id  INTEGER NOT NULL REFERENCES tydny(id) ON DELETE CASCADE,
  den       INTEGER NOT NULL CHECK (den BETWEEN 1 AND 5),
  zavreno   INTEGER NOT NULL DEFAULT 0,
  poznamka  TEXT    NOT NULL DEFAULT '',
  UNIQUE (tyden_id, den)
);


-- -------------------------------------------------------------------
--  Jednotlivá jídla. `poradi` drží pořadí v rámci dne, aby šlo
--  jídlem posouvat nahoru a dolů.
--
--  Alergeny jsou čísla 1–14 oddělená čárkou, např. '1,3,7'. Samostatná
--  tabulka by tu byla zbytečná – nikdy se podle nich nevyhledává.
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jidla (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  den_id    INTEGER NOT NULL REFERENCES dny(id) ON DELETE CASCADE,
  poradi    INTEGER NOT NULL,
  typ       TEXT    NOT NULL CHECK (typ IN ('polevka', 'hlavni')),
  nazev     TEXT    NOT NULL,
  cena      INTEGER NOT NULL,                     -- v celých korunách
  alergeny  TEXT    NOT NULL DEFAULT '',          -- '1,3,7'
  bez_masa  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS jidla_podle_dne ON jidla (den_id, poradi);


-- ===================================================================
--  Následující dvě tabulky se používají až od fáze 2 (administrace).
--  Zakládáme je rovnou, ať se schéma nemusí později měnit.
-- ===================================================================

-- -------------------------------------------------------------------
--  Přihlášení. V databázi je jen SHA-256 otisk tokenu, ne token sám –
--  kdyby někdo viděl obsah databáze, přihlásit se podle ní nedokáže.
--  Díky téhle tabulce taky „Odhlásit“ opravdu platí: smaže se řádek,
--  ne jen cookie v prohlížeči.
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relace (
  token_hash  TEXT PRIMARY KEY,
  vytvoreno   TEXT NOT NULL DEFAULT (datetime('now')),
  plati_do    TEXT NOT NULL
);

-- -------------------------------------------------------------------
--  Ochrana proti hádání hesla: 5 chybných pokusů z jedné IP adresy
--  a následuje 15 minut pauza.
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pokusy (
  ip             TEXT PRIMARY KEY,
  chyb           INTEGER NOT NULL DEFAULT 0,
  blokovano_do   TEXT
);
