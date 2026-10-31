/*
  Přihlašování do administrace.

  Jeden společný účet pro restauraci, chráněný heslem. Heslo samotné
  nikde není – ani v kódu, ani v databázi. Uložený je jen jeho otisk
  (secret ADMIN_HESLO_HASH), ze kterého heslo zpátky spočítat nejde.

  Po úspěšném přihlášení se vyrobí náhodný token, uloží se do cookie
  v prohlížeči a jeho otisk do tabulky `relace`. Díky tomu „Odhlásit“
  opravdu platí – smaže se řádek v databázi, ne jen cookie.
*/

const COOKIE = 'ug_relace';
const PLATNOST_DNU = 30;
const MAX_POKUSU = 5;
const BLOKACE_MINUT = 15;

/* ----------------------------  heslo  ---------------------------- */

const zB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/*
  Porovnání, které trvá vždycky stejně dlouho, ať se otisky liší v prvním
  nebo v posledním bajtu. Kdyby se porovnávalo běžně (a === b), dal by se
  z rozdílů v čase odpovědi otisk postupně uhodnout.
*/
function stejneBajty(a, b) {
  if (a.length !== b.length) return false;
  let rozdil = 0;
  for (let i = 0; i < a.length; i++) rozdil |= a[i] ^ b[i];
  return rozdil === 0;
}

async function pbkdf2(heslo, sul, opakovani) {
  const klic = await crypto.subtle.importKey('raw', new TextEncoder().encode(heslo), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bity = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sul, iterations: opakovani },
    klic,
    256
  );
  return new Uint8Array(bity);
}

/**
 * Ověří heslo proti uloženému otisku ve tvaru
 *   pbkdf2$<opakování>$<sůl v base64>$<otisk v base64>
 *
 * Počet opakování je součástí otisku, takže se dá kdykoli zvýšit
 * (po přechodu na placený tarif) bez zásahu do kódu.
 */
export async function overHeslo(heslo, ulozeny) {
  if (typeof ulozeny !== 'string') return false;
  /*
    Otisk se do Cloudflare vkládá ručně přes schránku, takže se k němu
    snadno přilepí mezera nebo konec řádku. Na konci by to prošlo samo
    (base64 je k takovému smetí shovívavé), na začátku ne – rozbilo by to
    hned porovnání s 'pbkdf2'. Přihlášení by pak nešlo a nikdo by nevěděl
    proč, tak to radši uklidíme tady.
  */
  const casti = ulozeny.trim().split('$');
  if (casti.length !== 4 || casti[0] !== 'pbkdf2') return false;

  const opakovani = Number(casti[1]);
  if (!Number.isInteger(opakovani) || opakovani < 1000) return false;

  try {
    const spocteny = await pbkdf2(heslo, zB64(casti[2]), opakovani);
    return stejneBajty(spocteny, zB64(casti[3]));
  } catch {
    return false;
  }
}

/* ----------------------------  relace  ---------------------------- */

const naHex = (bajty) => [...bajty].map((b) => b.toString(16).padStart(2, '0')).join('');

async function otisk(text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return naHex(new Uint8Array(h));
}

function prectiCookie(request, jmeno) {
  const hlavicka = request.headers.get('cookie') || '';
  for (const kus of hlavicka.split(';')) {
    const [k, ...zbytek] = kus.trim().split('=');
    if (k === jmeno) return zbytek.join('=');
  }
  return null;
}

/*
  Příznak Secure říká, že cookie se smí posílat jen přes https. Na ostrém
  webu ho chceme vždycky. Při zkoušení na http://localhost by ale cookie
  neprošla, proto tam výjimka.
*/
function jeZabezpeceno(request) {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return true;
  return !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function cookieRetez(request, hodnota, platnostSekund) {
  const casti = [
    `${COOKIE}=${hodnota}`,
    'Path=/',
    'HttpOnly', // JavaScript na stránce se k cookie nedostane
    'SameSite=Lax', // cizí web nemůže jménem přihlášeného nic odeslat
    `Max-Age=${platnostSekund}`,
  ];
  if (jeZabezpeceno(request)) casti.push('Secure');
  return casti.join('; ');
}

/** Založí novou relaci a vrátí hodnotu hlavičky Set-Cookie. */
export async function zalozRelaci(db, request) {
  const bajty = crypto.getRandomValues(new Uint8Array(32));
  const token = naHex(bajty);
  const platiDo = new Date(Date.now() + PLATNOST_DNU * 86400_000).toISOString().replace('T', ' ').slice(0, 19);

  await db.batch([
    // Při každém přihlášení zároveň uklidíme prošlé relace.
    db.prepare("DELETE FROM relace WHERE plati_do < datetime('now')"),
    db.prepare('INSERT INTO relace (token_hash, plati_do) VALUES (?, ?)').bind(await otisk(token), platiDo),
  ]);

  return cookieRetez(request, token, PLATNOST_DNU * 86400);
}

/** Je požadavek přihlášený? */
export async function jePrihlasen(db, request) {
  const token = prectiCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;

  const radek = await db
    .prepare("SELECT 1 AS ok FROM relace WHERE token_hash = ? AND plati_do > datetime('now')")
    .bind(await otisk(token))
    .first();

  return !!radek;
}

/** Zruší relaci v databázi a vrátí hlavičku, která smaže cookie. */
export async function zrusRelaci(db, request) {
  const token = prectiCookie(request, COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await db.prepare('DELETE FROM relace WHERE token_hash = ?').bind(await otisk(token)).run();
  }
  return cookieRetez(request, '', 0);
}

/* ---------------------  ochrana proti hádání  --------------------- */

export function adresaZadatele(request) {
  // Cloudflare posílá skutečnou adresu návštěvníka v téhle hlavičce.
  // Při zkoušení u sebe v počítači žádná není.
  return request.headers.get('cf-connecting-ip') || 'lokalni';
}

/** Vrátí počet minut, kolik ještě zbývá blokace, nebo 0. */
export async function zbyvaBlokace(db, ip) {
  const radek = await db
    .prepare(
      "SELECT CAST((julianday(blokovano_do) - julianday('now')) * 24 * 60 AS INTEGER) + 1 AS minut" +
        ' FROM pokusy WHERE ip = ? AND blokovano_do > datetime(\'now\')'
    )
    .bind(ip)
    .first();
  return radek ? Math.max(1, radek.minut) : 0;
}

/** Zapíše neúspěšný pokus. Po pátém zavře přihlašování na 15 minut. */
export async function zapisNeuspech(db, ip) {
  await db
    .prepare(
      `INSERT INTO pokusy (ip, chyb) VALUES (?, 1)
       ON CONFLICT(ip) DO UPDATE SET
         chyb = pokusy.chyb + 1,
         blokovano_do = CASE
           WHEN pokusy.chyb + 1 >= ${MAX_POKUSU} THEN datetime('now', '+${BLOKACE_MINUT} minutes')
           ELSE pokusy.blokovano_do
         END`
    )
    .bind(ip)
    .run();
}

/** Po úspěšném přihlášení se počítadlo vynuluje. */
export async function smazPokusy(db, ip) {
  await db.prepare('DELETE FROM pokusy WHERE ip = ?').bind(ip).run();
}

/* -------------------  pomůcky pro chráněné adresy  ------------------- */

/**
 * Hlídá, že požadavek na zápis přišel z našeho webu, ne z cizí stránky.
 * SameSite=Lax tohle už z velké části řeší, tohle je druhá pojistka.
 */
export function pochaziZNaseho(request) {
  const odkud = request.headers.get('origin');
  if (!odkud) return true; // běžný formulář bez JavaScriptu hlavičku nemusí poslat
  try {
    return new URL(odkud).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export const HLAVICKY_ADMIN = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  // Administrace nepatří do vyhledávačů.
  'x-robots-tag': 'noindex, nofollow',
};

export function odpovedJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Zkratka pro API: buď vrátí null (je přihlášen), nebo rovnou odpověď 401. */
export async function vyzadujPrihlaseni(db, request) {
  if (await jePrihlasen(db, request)) return null;
  return odpovedJson({ chyba: 'Nejsi přihlášený. Načti prosím stránku znovu a přihlas se.' }, 401);
}
