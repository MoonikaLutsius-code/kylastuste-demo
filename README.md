Külastuste ja müügi demo
Väike interaktiivne veebirakendus, mis uurib, kas kliendikülastuste ja müügi vahel on nähtav seos. Tehtud "Vibe Coding" koolituse praktilise harjutusena, AI-abiga (Claude) promptides ja koodi genereerides.
Avaldatud leht: https://moonikalutsius-code.github.io/kylastuste-demo/
Mida rakendus teeb
Näitab valitud kliendi kuist müüki joondiagrammina
Näitab samal ajateljel külastuste arvu kuu kaupa (ring, number ringi sees)
Hiirega graafikule minnes ilmub tooltip: kuu, müük, külastuste arv
Iga kliendi kohta arvutab automaatselt lühikese, ettevaatliku järelduse: kas müük kasvas/langes külastuste järel, või selget seost pole näha
Failid
Fail	Mida see teeb
`index.html`	Lehe struktuur, pealkiri, rippmenüü koht, stiilid
`sketch.js`	p5.js kood — joonistab graafiku, arvutab järelduse, haldab tooltip'i
`customers.json`	Andmed: kliendid, nende külastused ja kuine müük
Andmete kohta
Andmed sisaldavad 5 klienti reaalsete müügi- ja külastusandmetega (kliendinimed on juba algselt anonüümitud/väljamõeldud) ning ühte tehisandmetega näidisklienti ("Kuuse Kaubandus (NÄIDIS – tehisandmed)"), mis on lisatud teadlikult, et illustreerida, milline selge külastus→müük muster välja näeks. See näidisklient on rakenduses ja JSON-is selgelt märgistatud (`"synthetic": true`) ja ei kajasta reaalset äritulemust.
Oluline analüütiline põhimõte
Rakenduse arvutatud järeldused on kirjeldavad, mitte põhjuslikud. Isegi kui müük kasvab pärast külastust, ei tähenda see automaatselt, et külastus põhjustas kasvu — põhjuseks võib olla ka hooajalisus, juhus, või see, et suuremaid/langevaid kliente lihtsalt külastatakse sagedamini. Väikese valimi (5-6 klienti, mõned kuud andmeid kliendi kohta) puhul ei saa neid mustreid statistiliselt tõestada — need on mõeldud illustratiivseks lähtepunktiks, mitte lõplikuks äriotsuseks.
Kohalik testimine
`index.html` faili otse brauseris avades ei pruugi `customers.json` laadimine töötada (CORS piirang). Kasuta kohalikku serverit, nt:
```
python3 -m http.server
```
ja ava seejärel `http://localhost:8000`.
Taust
See on kärbitud, koolituse formaadile (4 kontaktpäeva, JSON + HTML/p5.js + GitHub Pages) sobiv harjutus, mis on üles ehitatud suurema, tulevikus Python/pandas + Streamlit peale ehitatava "Customer Visit Optimizer" projekti idee pealt.
