# Nasazení na Cloudflare — krok za krokem

Tenhle návod dostane web z tvého počítače na internet, na adresu
`https://ugustiku-web.pages.dev`. Všechno se vejde do **bezplatného tarifu**.

Počítej zhruba s **hodinou** a dělej to v klidu — každý krok si na konci
ověříme, takže poznáš, kde se případně něco zadrhlo.

> **Doména `ugustiku.cz` se v tomhle návodu vůbec nepoužívá.** Nesaháme na
> DNS, nic se nepřepojuje. E-mail přes Seznam Email Profi zůstává
> netknutý. Přepojení domény uděláme až nakonec a zvlášť — viz poslední
> kapitola.

---

## Co budeš potřebovat

- Účet na **Cloudflare** (založíš v kroku 1, zdarma, bez platební karty)
- Účet na **GitHubu** (zdarma)
- Nainstalovaný **Node.js** a **Git** — ty už máš, když ti běží `wrangler`

---

## Krok 1 — Účet na Cloudflare

1. Jdi na **<https://dash.cloudflare.com/sign-up>**.
2. Zadej e-mail a heslo, potvrď e-mail, který ti přijde.
3. Když se tě Cloudflare zeptá, jestli chceš přidat doménu, **přeskoč to**
   („Skip" / „I'll do this later"). Doménu teď opravdu nepřidáváme.

**Ověření:** vidíš přehled (dashboard) a nahoře vpravo svůj e-mail.

---

## Krok 2 — Přihlaš wrangler ke svému účtu

Wrangler je program, kterým se z počítače ovládá Cloudflare. Spusť:

```bash
npx wrangler login
```

Otevře se prohlížeč, přihlásíš se a potvrdíš přístup. Pak se vrať do terminálu.

**Ověření:**

```bash
npx wrangler whoami
```

Vypíše tvůj e-mail a Account ID. Když místo toho hlásí, že nejsi přihlášený,
zopakuj `npx wrangler login`.

---

## Krok 3 — Založ databázi D1

```bash
npx wrangler d1 create ugustiku
```

Příkaz vypíše něco takového:

```
✅ Successfully created DB 'ugustiku'

[[d1_databases]]
binding = "DB"
database_name = "ugustiku"
database_id = "a1b2c3d4-0000-1111-2222-333344445555"
```

**Zkopíruj to `database_id`** (ten dlouhý řetězec s pomlčkami) a vlož ho do
souboru `wrangler.toml` místo `"zatim-nevyplneno"`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ugustiku"
database_id = "a1b2c3d4-0000-1111-2222-333344445555"
```

> Tohle ID není tajné, klidně může být v gitu. Samo o sobě nikomu přístup nedá.

**Ověření:**

```bash
npx wrangler d1 list
```

V seznamu je `ugustiku`.

---

## Krok 4 — Vytvoř tabulky v ostré databázi

Pozor na `--remote` — bez něj by se příkaz provedl jen u tebe v počítači.

```bash
npx wrangler d1 execute ugustiku --remote --file=schema.sql
```

Potvrď dotaz stiskem `y`.

**Chceš do webu rovnou ukázková data?** Pak ještě:

```bash
npx wrangler d1 execute ugustiku --remote --file=seed.sql
```

Není to nutné — lístek můžeš napsat rovnou v administraci. Ukázková data
jsou ale praktická: hned uvidíš, že web funguje. Jídla pak jednoduše
přepíšeš.

**Ověření:**

```bash
npx wrangler d1 execute ugustiku --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Vypíše `tydny`, `dny`, `jidla`, `relace`, `pokusy`.

---

## Krok 5 — Nastav si heslo do administrace

Jestli jsi to ještě neudělal, vyrob si otisk hesla:

```bash
node scripts/hash-hesla.mjs
```

(Nemáš nápad na heslo? `node scripts/hash-hesla.mjs --navrhni`.)

Skript vypíše řetězec začínající `pbkdf2$25000$…`. **Zkopíruj ho celý.**

> Heslo si ulož do správce hesel v telefonu. Nikam ho nepiš, neposílej
> e-mailem a nedávej do gitu.

Secret nastavíme až v kroku 8, protože projekt na Cloudflare ještě neexistuje.

---

## Krok 6 — Nahraj projekt na GitHub

### 6a. Zkontroluj, že se necommitovalo nic tajného

```bash
git status
```

Soubor **`.dev.vars` se tu nesmí objevit** (je v `.gitignore`). Kdyby ano,
zastav se a ozvi se.

Zacommituj změnu `wrangler.toml` z kroku 3:

```bash
git add wrangler.toml && git commit -m "Doplněno database_id pro ostrou databázi D1"
```

### 6b. Založ repozitář

Na **<https://github.com/new>**:

- **Repository name:** `ugustiku-web`
- **Private** (doporučuju — není důvod dávat to na odiv)
- **Nezaškrtávej** „Add a README file" ani nic dalšího

Klikni **Create repository**. GitHub ti pak ukáže příkazy — použij tyhle
(doplň si svoje uživatelské jméno):

```bash
git remote add origin https://github.com/TVOJE-JMENO/ugustiku-web.git
```

```bash
git branch -M main && git push -u origin main
```

**Ověření:** obnov stránku repozitáře na GitHubu — vidíš složky `public`,
`functions`, `lib` a soubor `README.md`.

---

## Krok 7 — Propoj Cloudflare s GitHubem

1. V Cloudflare dashboardu vlevo: **Compute (Workers)** → **Workers & Pages**.
2. **Create application**. Cloudflare teď ukazuje novou obrazovku
   **„Make something new“**, která zakládá Workery – tou nechodí.
   Sjeď úplně dolů a klikni na odkaz **„Continue to Pages“**
   („Need to use the legacy Pages and functions?“). Pak **Connect to Git**.

   > Proč ne Worker: projekt stojí na Pages Functions – složka `functions/`
   > se směrováním podle názvů souborů, `_middleware.js` a
   > `pages_build_output_dir`. Ve Workeru by se serverová část musela přepsat.
3. Povol Cloudflare přístup k GitHubu. Vyber **jen repozitář `ugustiku-web`**
   (ne „All repositories").
4. Vyber repozitář a dej **Begin setup**.
5. Nastavení sestavení vyplň takhle:

   | Políčko | Hodnota |
   |---|---|
   | **Project name** | `ugustiku-web` |
   | **Production branch** | `main` |
   | **Framework preset** | `None` |
   | **Build command** | *nech prázdné* |
   | **Build output directory** | `public` |

   > Projekt nic nekompiluje — soubory v repozitáři jsou přesně to, co běží.
   > Kdyby Cloudflare samo nabídlo nějaký build command, smaž ho.

   > Název projektu si Cloudflare předvyplňuje podle repozitáře a určuje
   > adresu `<název>.pages.dev`. Později se přejmenovat nedá – šlo by jen
   > projekt smazat a založit znovu. Na dlouhou trať to nevadí, web
   > stejně pojede na ugustiku.cz; `.pages.dev` je jen dočasná adresa.

6. **Save and Deploy.**

První nasazení trvá asi minutu. **Veřejný web už po něm funguje** — jméno
a heslo potřebuje jen přihlášení do administrace, které nastavíme v kroku 8.
Do té doby `/admin` heslo nepřijme.

**Ověření:** v projektu je nasazení se zeleným **Success** a adresa
`https://ugustiku-web.pages.dev`.

---

## Krok 8 — Nastav heslo jako secret

```bash
npx wrangler pages secret put ADMIN_HESLO_HASH --project-name ugustiku-web
```

Příkaz se zeptá na hodnotu — vlož ten řetězec `pbkdf2$25000$…` z kroku 5
a potvrď Enterem. (Při vkládání se nic nevypíše, to je správně.)

**Ověření:**

```bash
npx wrangler pages secret list --project-name ugustiku-web
```

V seznamu je `ADMIN_HESLO_HASH`. Hodnota vidět není — tak to má být.

---

## Krok 9 — Spusť nasazení znovu

Secret se projeví až v novém nasazení. V dashboardu v projektu
**Deployments** → u posledního nasazení **⋯** → **Retry deployment**.

Nebo prostě pošli na GitHub jakoukoli změnu — nasazení se spustí samo.

---

## Krok 10 — Vyzkoušej hotový web

Otevři **`https://ugustiku-web.pages.dev`**.

| Co zkusit | Co má nastat |
|---|---|
| Úvodní stránka | Lístek na dnešek, o víkendu nejbližší otevřený den |
| Šipky a záložky Po–Pá | Přepínání dnů |
| `/admin` | Přihlašovací obrazovka |
| Přihlášení tvým heslem | Otevře se editor |
| Úprava jídla | Nahoře naskočí „Uloženo ✓“ |
| **Zveřejnit na webu** | Změna je na webu **do minuty** (stránka se minutu kešuje) |
| Export obrázku | Stáhne se PNG — zkontroluj háčky a čárky |

### ⚠️ Kontrola, kterou jsem ti slíbil už ve fázi 2

Bezplatný tarif dává každému požadavku **10 ms procesorového času**.
Přihlašování počítá PBKDF2 s 25 000 opakováními, což podle měření trvá
zhruba 4 ms — mělo by se to pohodlně vejít. **Teď se to poprvé ověřuje
doopravdy, na skutečném Cloudflare.**

- **Přihlášení proběhne** → je to v pořádku, hotovo.
- **Objeví se „Error 1102 — Worker exceeded resource limits"** → limit se
  přetáhl. Oprava: v `scripts/hash-hesla.mjs` sniž `OPAKOVANI` z `25000`
  třeba na `12000`, pusť skript znovu, nastav nový secret (krok 8) a znovu
  nasaď. Počet opakování je součástí otisku, v kódu se nic dalšího nemění.
  Pak se mi ozvi, ať to zapíšeme do README.

### Ještě zkus z telefonu

Administrace je dělaná hlavně pro mobil. Vyzkoušej na telefonu
přihlášení, úpravu jídla a **export obrázku i PDF** — ať víš, že to
v kuchyni opravdu půjde.

---

## Jak se web od teď aktualizuje

Každý `git push` do větve `main` spustí nové nasazení. Nic dalšího.

```bash
git add -A && git commit -m "Popis změny" && git push
```

Postup nasazení je vidět v dashboardu v **Deployments**. Kdyby se nové
nasazení nepovedlo, běží dál to předchozí — web nespadne.

> **Lístek se takhle měnit nemusí!** Ten se píše v administraci a ukládá se
> do databáze. Nasazení je potřeba jen při změně kódu nebo vzhledu.

---

## Na co si dát pozor

**Dočasná adresa se neindexuje.** Dokud web běží na `*.pages.dev`, posílá
hlavičku `noindex` — aby se adresa, která jednou zmizí, nedostala do
Googlu a nekonkurovala pak skutečné doméně. Jakmile přepojíme
`ugustiku.cz`, pravidlo se samo přestane uplatňovat.

**Náhledy větví sdílejí databázi.** Když si někdy založíš jinou větev,
Cloudflare pro ni udělá náhled na vlastní adrese — ale sahá do **stejné**
databáze. Pro jistotu v náhledech lístek needituj.

**Modrý pruh „Návrh nového webu"** zůstává nahoře, dokud jsou kontakty
zástupné. Až doplníš adresu a telefon, smaže se.

---

## Co zbývá doplnit

Než web půjde na vlastní doménu, je potřeba:

1. **Skutečné kontakty** místo `[ULICE A ČÍSLO]`, `[TELEFON]`, `[E-MAIL]`
   a otevírací doby. Jsou v `navrh/index.html`; po úpravě spusť
   `node scripts/udelat-sablonu.mjs`.
2. **Kontakt v patičce letáku** — konstanta `KONTAKT` v
   `public/admin/export.js`.
3. **Smazat modrý pruh** s poznámkou o návrhu.
4. **Mapa** v kontaktu je zatím jen rámeček.

---

## Přepojení domény ugustiku.cz — AŽ NAKONEC, SPOLU

**Tenhle krok teď nedělej.** Je tu jen proto, abys věděl, co nás čeká.

Doména je u Českého hostingu a běží na ní e-mail přes Seznam Email Profi.
Když se u DNS udělá chyba, **restaurace přestane dostávat e-maily** — a to
se pozná až se zpožděním. Proto to uděláme spolu a opatrně.

Co bude potřeba ohlídat:

- **Záznamy MX** (doručování pošty) musí zůstat **přesně** jak jsou.
- **Záznam SPF** (`TXT` začínající `v=spf1`) musí zůstat.
- **DKIM** (`TXT` na jménu typu `něco._domainkey`) musí zůstat.
- Mění se **jen** záznamy pro `ugustiku.cz` a `www`, které ukazují na web.

Postup, až na to dojde:

1. Nejdřív si **vypíšeme a uložíme všechny současné DNS záznamy**.
2. Rozhodneme, jestli převést celou doménu pod Cloudflare, nebo jen
   přidat vlastní doménu k projektu. Pro zachování e-mailu je bezpečnější
   nejdřív si všechno sepsat a teprve pak sáhnout na jediný záznam.
3. Po přepojení **zkusíme poslat a přijmout e-mail**, než to prohlásíme
   za hotové.

Napiš mi, až budeš chtít tenhle krok udělat.
