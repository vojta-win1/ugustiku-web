/*
  Odhlášení: POST /api/odhlaseni

  Smaže relaci v databázi (ne jen cookie v prohlížeči), takže odhlášení
  platí doopravdy – i kdyby někdo cookie zkopíroval jinam.
*/

import { pochaziZNaseho, zrusRelaci } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!pochaziZNaseho(request)) return new Response('Neplatný požadavek', { status: 400 });

  const cookie = await zrusRelaci(env.DB, request);
  return new Response(null, {
    status: 303,
    headers: { location: '/admin', 'set-cookie': cookie, 'cache-control': 'no-store' },
  });
}
