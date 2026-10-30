# U Gustíků — web restaurace

Web rodinné restaurace U Gustíků v Rehenicích s týdenním jídelním lístkem,
který si restaurace sama spravuje přes administraci.

Postaveno na **Cloudflare Pages** (statické soubory + serverové funkce) a
databázi **Cloudflare D1**. Všechno se vejde do bezplatného tarifu.

> **Stav:** hotová fáze 1 (veřejný web). Administrace, editor a export
> přibydou ve fázích 2–4.

---

## Co kde je

| Složka | K čemu je |
|---|---|
| `public/` | Soubory, které Cloudflare posílá rovnou: styl, skript, fotky, písma |
| `functions/` | Serverová část. Název souboru = adresa na webu |
| `lib/` | Sdílený kód (datum, databáze, vykreslení lístku, šablona stránky) |
| `scripts/` | Pomocné skripty, které se pouštějí ručně |
| `navrh/` | Schválený návrh designu a vzor lístku z Instagramu. Nepoužívá se za běhu |
| `schema.sql`, `seed.sql` | Struktura databáze a ukázková data |

Soubory v `lib/` jsou schválně **mimo** `functions/`. Cloudflare Pages totiž
z každého souboru ve `functions/` udělá adresu na webu — a sdílené moduly
na webu být nemají.

---

## Jak to spustit u sebe

Potřebuješ jen [Node.js](https://nodejs.org/). Všechno ostatní si stáhne `npx` sám.

**1. Založ databázi a nalij do ní ukázková data** (stačí jednou):

```bash
npx wrangler d1 execute ugustiku --local --file=schema.sql
```

```bash
npx wrangler d1 execute ugustiku --local --file=seed.sql
```

**2. Spusť web:**

```bash
npx wrangler pages dev
```

Otevři **http://localhost:8788**.

Data jsou uložená lokálně ve složce `.wrangler/` — s ostrou databází na
Cloudflare nemají nic společného, takže si tu můžeš zkoušet cokoliv.

### Co si vyzkoušet

| Adresa | Co ukáže |
|---|---|
| `/` | Dnešní den. O víkendu nejbližší další otevřený den |
| `/?den=ut` | Konkrétní den (`po`, `ut`, `st`, `ct`, `pa`) |
| `/?tyden=cely` | Celý týden pod sebou |

Dál zkus: šipky ‹ ›, záložky dnů, tlačítko **Celý týden**, rozbalení legendy
alergenů, tlačítko **Zpět** v prohlížeči, a jak to vypadá na mobilu
(v prohlížeči F12 → ikona telefonu).

**Zkouška bez JavaScriptu** — vypni si ho v prohlížeči a načti stránku znovu.
Uvidíš všech pět dnů pod sebou a záložky budou fungovat jako obyčejné odkazy.
Tak to vidí i Google.

### Jak si vyzkoušet zavřený den

V ukázkových datech je celý týden otevřený. Zavřít den jde takhle:

```bash
npx wrangler d1 execute ugustiku --local --command="UPDATE dny SET zavreno=1, poznamka='Státní svátek – zavřeno' WHERE den=3 AND tyden_id=(SELECT id FROM tydny WHERE pondeli='2026-10-26')"
```

Zpátky se den otevře stejným příkazem s `zavreno=0` a prázdnou poznámkou.
Od fáze 2 na to bude v administraci zaškrtávátko.

### Jak si vyzkoušet nezveřejněný týden

```bash
npx wrangler d1 execute ugustiku --local --command="UPDATE tydny SET zverejneno=0 WHERE pondeli='2026-10-26'"
```

Objeví se hláška s odkazem na Instagram. Zpátky `zverejneno=1`.

---

## Pomocné skripty

```bash
node scripts/test-vyber-dne.mjs
```
Zkontroluje pravidla pro výběr dne — víkend, zavřený den, přechod do dalšího
týdne. Běží bez databáze, dnešek se funkci podstrčí. Pusť po každé změně
v `lib/listek.js`.

```bash
node scripts/udelat-sablonu.mjs
```
Vygeneruje `lib/sablona.js` z `navrh/index.html`. Pusť, když se změní návrh.
**Ruční úpravy v `lib/sablona.js` tím zmizí.**

```bash
node scripts/stahnout-pisma.mjs
```
Stáhne písma z Google Fonts do `public/pisma/`. Hotové soubory jsou v gitu,
takže tenhle skript potřebuješ jen při výměně písma.

---

## Jak to funguje

### Lístek je v HTML už ze serveru

Stránku skládá `functions/index.js` při každém požadavku. Google, náhledy
odkazů na Facebooku i čtečky tak vidí celý lístek rovnou — nemusí spouštět
JavaScript.

Do HTML se vypisuje **všech pět dnů** a JavaScript ty neaktivní jen schovává.
Záložky a šipky jsou obyčejné odkazy (`?den=ut`), skript je jen zrychluje.
Bez JavaScriptu se tedy nic nerozbije.

### Který den se ukáže

1. Dnešek podle **pražského času** (ne podle času serveru, ten běží v UTC).
2. Víkend → rovnou pondělí příštího týdne.
3. Zavřený nebo nevyplněný den → nejbližší další otevřený, klidně i příští týden.
4. Potřebný týden není zveřejněný → hláška a odkaz na Instagram.

Pravidla jsou v `lib/listek.js` ve funkci `vyberZobrazeni()` a hlídá je
`scripts/test-vyber-dne.mjs`.

Karta **Dnes na talíři** v úvodu ukazuje vždycky dnešek, i když si
návštěvník dole listuje jiným dnem.

### Databáze

`tydny` → `dny` (1 = pondělí … 5 = pátek) → `jidla`. Klíčem týdne je datum
pondělí, třeba `2026-11-02`. Alergeny jsou čísla oddělená čárkou (`1,3,7`).
Podrobnosti i s vysvětlením jsou v komentářích v `schema.sql`.

Tabulky `relace` a `pokusy` se zaplní až ve fázi 2 (přihlašování).

### Rychlost a free tarif

Hotová stránka se na minutu ukládá do mezipaměti Cloudflare, takže se do
databáze chodí nejvýš jednou za minutu. Změna lístku je venku do minuty.

### Písma

Hostujeme je sami v `public/pisma/`, ne z Google Fonts. Dva důvody: GDPR
(jinak by každý návštěvník posílal svoji IP adresu Googlu) a export obrázku
a PDF ve fázi 3 — do něj jde vložit jen písmo ze stejné domény.

Staženou podmnožinou je `latin-ext`. Obyčejný `latin` neobsahuje
**ě š č ř ž ů**, takže by v nadpisech chyběly háčky a čárky.

---

## Co ještě není hotové

- `[ULICE A ČÍSLO]`, `[TELEFON]`, `[E-MAIL]` a otevírací doba jsou v návrhu
  zatím zástupné. Jsou v `navrh/index.html`; po doplnění stačí pustit
  `node scripts/udelat-sablonu.mjs`.
- Modrý pruh nahoře („Návrh nového webu…“) se před ostrým spuštěním smaže.
- Mapa v kontaktu je zatím jen rámeček.
- Administrace, editor lístku a export — fáze 2 až 4.

## Doména

Web poběží zatím na adrese `*.pages.dev`. Doména **ugustiku.cz** se zatím
nikam nepřepojuje a do DNS se nesahá — běží na ní e-mail přes Seznam Email
Profi (záznamy MX, SPF, DKIM), který se nesmí rozbít. Přepojení se udělá
až nakonec a zvlášť.
