# U Gustíků — web restaurace

Web rodinné restaurace U Gustíků v Řehenicích s týdenním jídelním lístkem,
který si restaurace sama spravuje přes administraci.

Postaveno na **Cloudflare Pages** (statické soubory + serverové funkce) a
databázi **Cloudflare D1**. Všechno se vejde do bezplatného tarifu.

> **Stav:** nasazeno a běží na **<https://ugustiku-web.pages.dev>**.
> Projekt v Cloudflare se jmenuje `ugustiku-web`, databáze D1 `ugustiku`.
> Postup nasazení krok za krokem je v **[NASAZENI.md](NASAZENI.md)**.

---

## Co kde je

| Složka | K čemu je |
|---|---|
| `public/` | Soubory, které Cloudflare posílá rovnou: styl, skript, fotky, písma |
| `functions/` | Serverová část. Název souboru = adresa na webu |
| `lib/` | Sdílený kód (datum, databáze, vykreslení lístku, šablona stránky) |
| `scripts/` | Pomocné skripty, které se pouštějí ručně |
| `public/admin/` | Vzhled a ovládání editoru lístku a exportu |
| `public/admin/vendor/` | Stažené knihovny pro export (viz `PUVOD.txt`) |
| `navrh/` | Schválený návrh designu a vzor lístku z Instagramu. Nepoužívá se za běhu |
| `NASAZENI.md` | Návod, jak web dostat na internet |
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

## Administrace

Je na adrese **/admin** (odkaz je i dole v patičce webu).

### Nastavení hesla — tohle udělej jako první

```bash
node scripts/hash-hesla.mjs
```

Skript se zeptá na heslo (psaní není vidět) a vypíše jeho otisk. Ten vlož
do souboru `.dev.vars` v hlavní složce projektu:

```
ADMIN_HESLO_HASH="pbkdf2$25000$...$..."
```

`.dev.vars` je v `.gitignore`, takže se do gitu nedostane. Na ostrý web se
stejná hodnota uloží ve fázi 4 příkazem
`npx wrangler pages secret put ADMIN_HESLO_HASH`.

Nenapadá tě heslo? `node scripts/hash-hesla.mjs --navrhni` ti nějaké vymyslí.

**Změna hesla** = pustit skript znovu a přepsat hodnotu. V kódu se nic nemění.

> Soubor `.dev.vars` teď obsahuje jednorázový otisk z vývoje. Pusť skript
> a nahraď ho vlastním heslem.

### Jak přihlášení funguje

- Heslo se nikde neukládá, jen jeho otisk spočítaný **PBKDF2-SHA256**.
- Přihlášení platí **30 dní**. V prohlížeči je cookie s náhodným tokenem
  (`HttpOnly`, `Secure`, `SameSite=Lax`), v databázi jen jeho otisk.
- **Odhlásit** smaže záznam v databázi, takže odhlášení opravdu platí.
- Po **5 špatných pokusech** se přihlašování na **15 minut** zavře.
  Už přihlášených zařízení se to netýká.
- `/admin` má `noindex` v hlavičce i v `robots.txt`. Každé API pro zápis
  si ověřuje přihlášení a navíc kontroluje, že požadavek nepřišel z cizí stránky.

#### Proč 25 000 opakování PBKDF2 a ne 100 000

Bezplatný tarif Cloudflare dává každému požadavku **10 ms procesorového
času**. Naměřeno:

| opakování | čas |
|---|---|
| 25 000 | 4,3 ms |
| 50 000 | 6,9 ms |
| 100 000 | 14,4 ms — nevejde se |

**Ověřeno na ostrém serveru** (31. 10. 2026): přihlašovací požadavek
s 25 000 opakováními probehl normálně, bez chyby 1102 – špatný pokus se
zapsal do tabulky `pokusy`, což se stane až po dopočítání otisku.

Proto 25 000 a jako protiváhu skript nepřijme heslo kratší než 12 znaků.
Hádat heslo přes web stejně nejde kvůli těm pěti pokusům; otisk by musel
někdo nejdřív ukrást přímo z účtu Cloudflare. Počet opakování je součástí
uloženého otisku — po přechodu na placený tarif stačí zvýšit `OPAKOVANI`
ve skriptu a heslo nastavit znovu.

### Editor lístku

- Nahoře **‹ ›** přepínají týden. Otevře se ten, ve kterém jsme dnes.
- **Zkopírovat minulý týden** vezme jídla z předchozího týdne jako základ.
- Záložky **Po–Pá**, u každé tečka: zelená = něco tam je, červená = zavřeno.
- U dne jde zapnout **Zavřeno** a připsat poznámku. Jídla se nemažou,
  jen se nezobrazí — po vypnutí jsou zase zpátky.
- Jídlo má typ (polévka / hlavní chod), název, cenu, **Bez masa**
  a alergeny jako zaškrtávátka s názvy. Jde posouvat ↑ ↓ a mazat.
- **Ukládá se samo** 0,8 vteřiny po poslední změně. Nahoře je vidět
  „Ukládám… / Uloženo ✓“. Při zavření stránky s neuloženou změnou se
  prohlížeč zeptá; na mobilu se navíc uloží i při přepnutí do jiné aplikace.
- **Zveřejnit na webu** pustí týden ven. Dokud se nezmáčkne, je to koncept,
  který nikdo nevidí. Po zveřejnění jde lístek dál upravovat a změny jsou
  venku do minuty.
- **Náhled** vedle editoru používá úplně stejný vykreslovací kód jako
  veřejný web, takže nemůže ukazovat něco jiného. Na mobilu se mezi
  editorem a náhledem přepíná tlačítky **Upravit / Náhled**.

### Export pro Instagram a tisk

V editoru dole jsou tři tlačítka. Všechno se počítá přímo v prohlížeči,
takže to nic nestojí a funguje to i na telefonu.

| Tlačítko | Co vyrobí | Doba na počítači |
|---|---|---|
| Obrázek pro Instagram | PNG 1080 × 1350 (4:5), celý týden | ~1 s |
| Leták PDF (A4) | PDF A4 na výšku, s legendou alergenů a kontaktem | ~4 s |
| Menu dne do Stories | PNG 1080 × 1920, právě vybraný den | ~0,5 s |

Na telefonu to trvá déle, u letáku klidně deset vteřin. Průběh je vidět
vedle nadpisu „Export“.

Vzhled vychází z lístku, který restaurace dává na Instagram
(`navrh/vzor-listek.jpg`): kolečko s cenou menu, logo, nadpis, dny
podtržené modře a tečkovaná linka k ceně. Písma a barvy jsou z nového webu.

**Text se vždycky vejde.** Po složení se změří výška a půlením intervalu
se najde největší písmo, při kterém se celý lístek vejde — nikdy se nic
neořezává. Krátký lístek se naopak zvětší, aby obrázek nekončil
poloprázdný. Když je lístek opravdu dlouhý, dá to editor vědět, ať se
výsledek zkontroluje.

**Diakritika v exportu.** Písma se do obrázku vkládají celá. Proto je
hostujeme sami a proto stahujeme podmnožinu `latin-ext` — bez ní by
v obrázku chyběly háčky a čárky. Obrázek se schválně kreslí dvakrát
a bere se až druhý: Safari na iPhonu napoprvé občas nestihne písma
načíst a vyrobil by lístek systémovým písmem.

**Kontakt v patičce letáku** je zatím zástupný. Až budou známé skutečné
údaje, uprav je nahoře v `public/admin/export.js` (konstanta `KONTAKT`).

### Co si vyzkoušet

1. Otevři `/admin`, přihlas se.
2. Přepni se šipkou **›** na týden 2.–6. 11. 2026 — je to rozepsaný koncept.
3. Zkus přidat jídlo, zaškrtnout alergeny, posunout ho, zavřít den.
4. Dej **Zveřejnit na webu** a podívej se na `/`.
5. Zkus zavřít a znovu otevřít stránku — rozepsané se neztratí.
6. Dole dej **Obrázek pro Instagram** a podívej se na stažený soubor —
   zkontroluj háčky a čárky.
7. Zkus se pětkrát přihlásit špatným heslem a uvidíš patnáctiminutovou pauzu.
   (Odblokovat jde příkazem
   `npx wrangler d1 execute ugustiku --local --command="DELETE FROM pokusy"`.)

---

## Pomocné skripty

```bash
node scripts/test-vyber-dne.mjs
```
Zkontroluje pravidla pro výběr dne — víkend, zavřený den, přechod do dalšího
týdne. Běží bez databáze, dnešek se funkci podstrčí. Pusť po každé změně
v `lib/listek.js`.

```bash
node scripts/stahnout-knihovny.mjs
```
Stáhne knihovny pro export (html-to-image, jsPDF) do `public/admin/vendor/`.
Jsou v gitu, takže tohle je potřeba jen při aktualizaci. Netaháme je z CDN:
export pak funguje nezávisle, nic se neposílá cizím serverům a obsahová
politika stránky může zůstat přísná.

```bash
node scripts/hash-hesla.mjs
```
Nastaví heslo do administrace. Potřebuje opravdový terminál — přes rouru
schválně nefunguje, aby heslo nezůstalo v historii příkazů.

```bash
node scripts/zkontroluj-heslo.mjs
```
Řekne, jestli heslo odpovídá otisku – **jen u tebe na počítači**, nic se
nikam neposlá. K čemu to je: když se nejde přihlásit, zkoušet to na webu
je drahé, protože po pěti špatných pokusech se přihlašování na 15 minut
zavře. Tohle se dá zkoušet donekonečna.

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

Tabulky `relace` (přihlášení) a `pokusy` (ochrana proti hádání hesla)
obsluhuje `lib/auth.js`.

Celý týden se ukládá najednou jako jedna dávka příkazů, kterou D1 provede
jako transakci. Buď projde všechno, nebo nic — nemůže se stát, že by se
smazala stará jídla a nová se neuložila.

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

- **Fotky** v úvodu a v galerii jsou zatím orientační, čekají na skutečné.
- **Doména ugustiku.cz** se zatím nepřepojuje – viz níž.

### Kontakty – kde se mění

Skutečné údaje jsou dopleněné (Kříváček 17, 251 67 Řehenice,
+420 776 107 716, klenhova@ugustiku.cz, Po–Pá 6:00–14:00). Kdyby se
něco změnilo, jsou na **dvou** místech a musí se srovnat obě:

1. `navrh/index.html` – web. Po úpravě pusť `node scripts/udelat-sablonu.mjs`,
   který z něj vyrobí `lib/sablona.js`.
2. `public/admin/export.js` – konstanta `KONTAKT`, patička letáku A4.

Telefon a e-mail v sekci Kontakt jsou odkazy `tel:` a `mailto:`, aby se
na mobilu daly použít jedním klepnutím. Mapa je odkaz do Mapy.com –
žádný cizí obsah se do stránky nenahrává, takže nikomu nehlásí,
kdo si web otevřel.

## Nasazení

Postup krok za krokem — účet, databáze D1, heslo, napojení na GitHub —
je v **[NASAZENI.md](NASAZENI.md)**.

Po nasazení se web aktualizuje prostým `git push` do větve `main`.
Lístek se tímhle měnit nemusí, ten se píše v administraci.

Secrety se připojují k nasazení ve chvíli, kdy vzniká. Když tedy změníš
`ADMIN_HESLO_HASH`, musí po tom přijít nové nasazení – jinak běží dál
to staré s původním heslem.

Dokud web běží na dočasné adrese `*.pages.dev`, posílá hlavičku `noindex` —
aby se adresa, která jednou zmizí, nedostala do Googlu a nekonkurovala pak
skutečné doméně. Na vlastní doméně se pravidlo samo přestane uplatňovat.

## Doména

Doména **ugustiku.cz** se zatím nikam nepřepojuje a do DNS se nesahá — běží
na ní e-mail přes Seznam Email Profi (záznamy MX, SPF, DKIM), který se nesmí
rozbít. Přepojení se udělá až nakonec a zvlášť; na co si dát pozor, je
na konci [NASAZENI.md](NASAZENI.md).
