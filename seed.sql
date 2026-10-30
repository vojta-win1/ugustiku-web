-- ===================================================================
--  Ukázková data.
--
--  Spuštění:  npx wrangler d1 execute ugustiku --local --file=seed.sql
--
--  Obsahuje dva týdny:
--    26.–30. 10. 2026  – zveřejněný, jídla z návrhu (navrh/index.html)
--     2.–6.  11. 2026  – nezveřejněný koncept, se zavřenou středou
--
--  Druhý týden je tu schválně: o víkendu web skáče na příští týden,
--  takže si můžeš vyzkoušet hlášku „zatím není zveřejněno“, a ve fázi 2
--  bude mít editor hned co ukazovat.
--
--  POZOR: soubor nejdřív oba týdny smaže, aby se při opakovaném
--  spuštění data nezdvojila. Na ostré databázi ho nepouštěj.
-- ===================================================================

DELETE FROM tydny WHERE pondeli IN ('2026-10-26', '2026-11-02');


-- ===================  26.–30. 10. 2026  (zveřejněný)  ===============

INSERT INTO tydny (pondeli, zverejneno, zverejneno_v)
VALUES ('2026-10-26', 1, datetime('now'));

INSERT INTO dny (tyden_id, den)
SELECT id, 1 FROM tydny WHERE pondeli = '2026-10-26'
UNION ALL SELECT id, 2 FROM tydny WHERE pondeli = '2026-10-26'
UNION ALL SELECT id, 3 FROM tydny WHERE pondeli = '2026-10-26'
UNION ALL SELECT id, 4 FROM tydny WHERE pondeli = '2026-10-26'
UNION ALL SELECT id, 5 FROM tydny WHERE pondeli = '2026-10-26';

-- Pomocný pohled by byl přehnaný; den si pokaždé najdeme poddotazem.
INSERT INTO jidla (den_id, poradi, typ, nazev, cena, alergeny, bez_masa) VALUES
-- pondělí
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=1), 1, 'polevka', 'Dršťková polévka', 45, '1,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=1), 2, 'hlavni', 'Vepřové na paprice s těstovinami', 170, '1,3,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=1), 3, 'hlavni', 'Grilovaný hermelín se zeleninovým salátem', 150, '1,3,7', 1),
-- úterý
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=2), 1, 'polevka', 'Zeleninový krém', 45, '1,3,7,9', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=2), 2, 'hlavni', 'Kančí ragú se šťouchaným bramborem', 170, '1,3,7,9,10', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=2), 3, 'hlavni', 'Kuřecí směs s dušenou rýží', 170, '1,3,6,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=2), 4, 'hlavni', 'Květákové placičky se šťouchaným bramborem', 120, '1,3,7', 1),
-- středa
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=3), 1, 'polevka', 'Gulášová polévka', 45, '1,3,7,9', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=3), 2, 'hlavni', 'Vařené hovězí maso s rajskou omáčkou a houskovým knedlíkem', 170, '1,3,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=3), 3, 'hlavni', 'Vepřový špíz s hranolky a americkým dresinkem', 170, '3,7,8,9,10', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=3), 4, 'hlavni', 'Bramborové šišky se zelím a cibulkou', 120, '1,3,7', 1),
-- čtvrtek
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=4), 1, 'polevka', 'Hovězí vývar', 39, '1,3,7,9', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=4), 2, 'hlavni', 'Vepřová líčka na kořenové zelenině se šťouchaným bramborem', 170, '1,3,7,9,10', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=4), 3, 'hlavni', 'Uzená krkovice s bramborovým knedlíkem a zelím', 170, '1,3,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=4), 4, 'hlavni', 'Zeleninový salát s balkánským sýrem', 120, '7', 1),
-- pátek
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=5), 1, 'polevka', 'Šumavská bramboračka', 45, '1,3,7,9', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=5), 2, 'hlavni', 'Kuřecí stehenní nebo vepřový řízek, bramborová kaše / salát', 170, '1,3,7,9,10', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-10-26' AND d.den=5), 3, 'hlavni', 'Palačinky s marmeládou a zakysanou smetanou', 120, '1,3,7', 1);


-- ===============  2.–6. 11. 2026  (rozpracovaný koncept)  ===========

INSERT INTO tydny (pondeli, zverejneno) VALUES ('2026-11-02', 0);

INSERT INTO dny (tyden_id, den, zavreno, poznamka)
SELECT id, 1, 0, '' FROM tydny WHERE pondeli = '2026-11-02'
UNION ALL SELECT id, 2, 0, '' FROM tydny WHERE pondeli = '2026-11-02'
UNION ALL SELECT id, 3, 1, 'Školení personálu – zavřeno' FROM tydny WHERE pondeli = '2026-11-02'
UNION ALL SELECT id, 4, 0, '' FROM tydny WHERE pondeli = '2026-11-02'
UNION ALL SELECT id, 5, 0, '' FROM tydny WHERE pondeli = '2026-11-02';

INSERT INTO jidla (den_id, poradi, typ, nazev, cena, alergeny, bez_masa) VALUES
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=1), 1, 'polevka', 'Česnečka s krutony a sýrem', 45, '1,3,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=1), 2, 'hlavni', 'Svíčková na smetaně s houskovým knedlíkem', 175, '1,3,7,9,10', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=1), 3, 'hlavni', 'Smažený sýr s hranolky a tatarkou', 150, '1,3,7,10', 1),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=2), 1, 'polevka', 'Dýňový krém s opraženými semínky', 45, '7,9', 1),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=2), 2, 'hlavni', 'Pečené kuřecí stehno s bramborem a zelím', 170, '1,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=4), 1, 'polevka', 'Hovězí vývar s nudlemi', 39, '1,3,7,9', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=4), 2, 'hlavni', 'Guláš z hovězího líčka s knedlíkem', 175, '1,3,7', 0),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=5), 1, 'polevka', 'Kulajda s vejcem', 45, '1,3,7', 1),
((SELECT d.id FROM dny d JOIN tydny t ON t.id = d.tyden_id WHERE t.pondeli='2026-11-02' AND d.den=5), 2, 'hlavni', 'Vepřový řízek s bramborovou kaší', 170, '1,3,7', 0);
