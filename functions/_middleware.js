/*
  Běží před každým požadavkem a přidává bezpečnostní hlavičky.

  Soubor se jmenuje s podtržítkem schválně – Cloudflare Pages z něj pak
  neudělá samostatnou adresu na webu, ale použije ho jako mezivrstvu.
*/

export async function onRequest({ request, next }) {
  const odpoved = await next();

  // Statické soubory (obrázky, písma) necháme být, hlavičky patří ke stránkám.
  const typ = odpoved.headers.get('content-type') || '';
  if (!typ.includes('text/html')) return odpoved;

  const h = new Headers(odpoved.headers);

  /*
    Dočasná adresa *.pages.dev se nemá dostat do vyhledávačů. Kdyby se
    zaindexovala, konkurovala by pak v Googlu skutečné doméně ugustiku.cz
    a lidem by se nabízela adresa, která jednou zmizí.

    Jakmile web poběží na vlastní doméně, tohle pravidlo se samo přestane
    uplatňovat – nemusí se na nic pamatovat. Totéž platí pro náhledy
    jednotlivých větví, které Cloudflare vytváří taky na *.pages.dev.
  */
  if (new URL(request.url).hostname.endsWith('.pages.dev')) {
    h.set('x-robots-tag', 'noindex, nofollow');
  }

  // Prohlížeč nemá hádat typ souboru podle obsahu.
  h.set('x-content-type-options', 'nosniff');
  // Stránku nesmí nikdo vložit do rámu na cizím webu (ochrana proti klikacím podvodům).
  h.set('x-frame-options', 'SAMEORIGIN');
  // Při odchodu na cizí web posíláme jen doménu, ne celou adresu.
  h.set('referrer-policy', 'strict-origin-when-cross-origin');
  // Nepotřebujeme kameru, mikrofon ani polohu – rovnou je zakážeme.
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  /*
    Obsahová politika: skripty, styly a obrázky smí stránka brát jen
    sama ze sebe. 'unsafe-inline' u stylů tu je proto, že návrh používá
    style="..." přímo u několika prvků.
  */
  h.set(
    'content-security-policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      /*
        'self' a ne 'none': knihovna html-to-image si při výrobě obrázku
        nastavuje <base>, aby správně dopočítala relativní adresy v CSS.
        Proti útoku to chrání pořád – podvrhnout cizí doménu nejde.
      */
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ')
  );

  return new Response(odpoved.body, { status: odpoved.status, headers: h });
}
