/*
  Živý náhled lístku:  /admin/nahled/2026-11-02?den=po

  Běží v rámečku vedle editoru. Vykresluje se stejnou funkcí listekHtml()
  jako veřejný web, takže náhled nemůže ukazovat něco jiného, než co
  uvidí hosté. Rozdíl je jen v tom, že sem se dostane i nezveřejněný
  koncept – a jen po přihlášení.
*/

import { HLAVICKY_ADMIN, jePrihlasen } from '../../../lib/auth.js';
import { jePlatneDatum, pondeliTydne } from '../../../lib/datum.js';
import { nactiTyden } from '../../../lib/db.js';
import { KODY_DNU, listekHtml } from '../../../lib/listek.js';

export async function onRequestGet({ request, env, params }) {
  if (!env.DB || !(await jePrihlasen(env.DB, request))) {
    return new Response('Nejsi přihlášený.', { status: 401, headers: HLAVICKY_ADMIN });
  }

  const pondeli = params.pondeli;
  if (!jePlatneDatum(pondeli) || pondeliTydne(pondeli) !== pondeli) {
    return new Response('Neplatný týden.', { status: 400, headers: HLAVICKY_ADMIN });
  }

  const url = new URL(request.url);
  const celyTyden = url.searchParams.get('tyden') === 'cely';
  const index = Math.max(0, KODY_DNU.indexOf(url.searchParams.get('den') || 'po'));

  const tyden = await nactiTyden(env.DB, pondeli);

  const listek = tyden
    ? listekHtml({ stav: 'ok', tyden, pondeli, index, autoIndex: index, celyTyden, jeDnesek: false })
    : listekHtml({ stav: 'nezverejneno', pondeli, jePristiTyden: false });

  return new Response(
    `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Náhled lístku</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/styl.css">
<style>
  /* Náhled je výřez stránky, ne celá stránka – proto bez okrajů navrchu. */
  body{background:var(--paper)}
  .menu{border-block:0}
  .menu .wrap{padding-block:28px}
</style>
</head>
<body>
${listek}
<script src="/web.js" defer></script>
</body>
</html>`,
    { headers: HLAVICKY_ADMIN }
  );
}
