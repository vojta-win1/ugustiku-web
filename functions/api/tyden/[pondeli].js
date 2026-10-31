/*
  Čtení a zápis jednoho týdne:  /api/tyden/2026-11-02

    GET   – vrátí týden
    PUT   – uloží rozpracovaný lístek (tohle volá průběžné ukládání)
    POST  – akce: zveřejnit, skrýt, zkopírovat minulý týden

  Všechno vyžaduje přihlášení. Veřejný web tohle API nepoužívá – ten si
  lístek bere rovnou z databáze při skládání stránky.
*/

import { odpovedJson, pochaziZNaseho, vyzadujPrihlaseni } from '../../../lib/auth.js';
import { jePlatneDatum, pondeliTydne, posunDnu } from '../../../lib/datum.js';
import {
  nactiTyden,
  nastavZverejneni,
  overDataTydne,
  ulozTyden,
  zkopirujMinulyTyden,
} from '../../../lib/db.js';

/** Společná kontrola pro všechny metody. Vrátí chybovou odpověď, nebo null. */
async function pripravit(context, meniData) {
  const { request, env, params } = context;

  if (!env.DB) return { chyba: odpovedJson({ chyba: 'Databáze není dostupná.' }, 503) };

  const neprihlasen = await vyzadujPrihlaseni(env.DB, request);
  if (neprihlasen) return { chyba: neprihlasen };

  if (meniData && !pochaziZNaseho(request)) {
    return { chyba: odpovedJson({ chyba: 'Požadavek přišel z cizí stránky.' }, 403) };
  }

  const pondeli = params.pondeli;
  if (!jePlatneDatum(pondeli) || pondeliTydne(pondeli) !== pondeli) {
    return { chyba: odpovedJson({ chyba: 'Týden se určuje datem pondělí, třeba 2026-11-02.' }, 400) };
  }

  return { pondeli };
}

/** Týden i s prázdnými dny – editor čeká vždycky pět dnů. */
function prazdny(pondeli) {
  return {
    pondeli,
    zverejneno: false,
    upravenoV: null,
    dny: [1, 2, 3, 4, 5].map((cislo) => ({ cislo, zavreno: false, poznamka: '', jidla: [] })),
  };
}

export async function onRequestGet(context) {
  const { chyba, pondeli } = await pripravit(context, false);
  if (chyba) return chyba;

  const data = (await nactiTyden(context.env.DB, pondeli)) || prazdny(pondeli);
  return odpovedJson(data);
}

export async function onRequestPut(context) {
  const { chyba, pondeli } = await pripravit(context, true);
  if (chyba) return chyba;

  let telo;
  try {
    telo = await context.request.json();
  } catch {
    return odpovedJson({ chyba: 'Data se nepodařilo přečíst.' }, 400);
  }

  const overeno = overDataTydne(telo?.dny);
  if (!overeno.ok) return odpovedJson({ chyba: overeno.chyba }, 400);

  await ulozTyden(context.env.DB, pondeli, overeno.dny);

  const data = await nactiTyden(context.env.DB, pondeli);
  return odpovedJson({ ulozeno: true, tyden: data });
}

export async function onRequestPost(context) {
  const { chyba, pondeli } = await pripravit(context, true);
  if (chyba) return chyba;

  let telo;
  try {
    telo = await context.request.json();
  } catch {
    return odpovedJson({ chyba: 'Data se nepodařilo přečíst.' }, 400);
  }

  const db = context.env.DB;

  switch (telo?.akce) {
    case 'zverejnit':
    case 'skryt': {
      const existuje = await nactiTyden(db, pondeli);
      if (!existuje) {
        return odpovedJson({ chyba: 'Tenhle týden ještě není uložený, není co zveřejnit.' }, 400);
      }
      await nastavZverejneni(db, pondeli, telo.akce === 'zverejnit');
      break;
    }

    case 'kopirovat-minuly': {
      const vysledek = await zkopirujMinulyTyden(db, pondeli, posunDnu(pondeli, -7));
      if (!vysledek.ok) return odpovedJson({ chyba: vysledek.chyba }, 400);
      break;
    }

    default:
      return odpovedJson({ chyba: 'Neznámá akce.' }, 400);
  }

  return odpovedJson({ ulozeno: true, tyden: await nactiTyden(db, pondeli) });
}
