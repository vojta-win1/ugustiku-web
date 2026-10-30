/*
  Veřejná úvodní stránka.

  Všechno se skládá tady na serveru, takže Google i náhledy odkazů
  dostanou hotový lístek rovnou v HTML.

  Adresy:
    /                 – dnešní den (o víkendu nejbližší otevřený)
    /?den=ut          – konkrétní den
    /?tyden=cely      – celý týden pod sebou
*/

import { pondeliTydne, dnesVPraze } from '../lib/datum.js';
import { kartaHtml, listekHtml, titulekStranky, vyberZobrazeni } from '../lib/listek.js';
import { strankaHtml } from '../lib/sablona.js';

async function sestavStranku(request, env) {
  const url = new URL(request.url);

  let stav;
  let status = 200;
  try {
    if (!env.DB) throw new Error('Chybí napojení na databázi D1 (binding DB).');
    stav = await vyberZobrazeni(env.DB, {
      den: url.searchParams.get('den'),
      celyTyden: url.searchParams.get('tyden') === 'cely',
    });
  } catch (chyba) {
    // Výpadek databáze nesmí shodit celý web – zbytek stránky (kontakt,
    // otevírací doba, telefon) je pro hosta pořád užitečný.
    console.error('Nepodařilo se načíst lístek:', chyba);
    stav = { stav: 'chyba', pondeli: pondeliTydne(dnesVPraze()), jePristiTyden: false };
    status = 503;
  }

  const html = strankaHtml({
    titulek: titulekStranky(stav),
    karta: kartaHtml(stav),
    listek: listekHtml(stav),
  });

  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      /*
        Stránka se na minutu uloží do mezipaměti Cloudflare (s-maxage).
        Návštěvníci ji tak dostanou rovnou z nejbližšího serveru a do
        databáze se chodí jen jednou za minutu – šetří to free tarif.
        Po úpravě lístku je změna venku nejpozději do minuty.
      */
      'cache-control':
        status === 200
          ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
          : 'no-store',
    },
  });
}

export const onRequestGet = ({ request, env }) => sestavStranku(request, env);

/*
  Požadavek HEAD je totéž co GET, jen bez těla odpovědi. Používají ho
  hlídače dostupnosti a někteří roboti – bez tohohle by dostali 404.
*/
export async function onRequestHead({ request, env }) {
  const odpoved = await sestavStranku(request, env);
  return new Response(null, { status: odpoved.status, headers: odpoved.headers });
}
