# De Lijn-integratie — 27 oktober 2026

## Beschikbaar

- 24.613 echte reguliere/gedeelde De Lijn-haltes, samen met NMBS in zoeken, kaart, favorieten en de vijf dichtstbijzijnde haltes.
- Filter op vervoerder in Ontdekken; zoeken op naam, gemeente en haltecode.
- Vertrekken: publiek lijnnummer, bestemming, geplande tijd, bronvertraging indien expliciet REALTIME, afschaffing en niet-bediende halte.
- Eindhalte-aankomsten, NOBOARDING en vertrokken passages worden niet aangeboden als instapvertrek.
- Lijnfilter en concrete ritselectie; Mijn lijn toont de volledige bronvolgorde, stoptijden en gepasseerde haltes.
- Geen GPS-simulatie. Kaartlijnen blijven schematisch.
- Busrouteplanning opent expliciet de officiële De Lijn-routeplanner. De ingebouwde routeberekening blijft NMBS; er is nog geen gecombineerde bus-treinrouter.

## Bronnen

Halte-index: [Digitaal Vlaanderen, halteplaatsen](https://geo.api.vlaanderen.be/Haltes/ogc/features/v1/collections/Halte/items?f=application%2Fjson). De bron levert 29.351 plaatsen. De export bevat types 1 en 2 (regulier of gedeeld), geen uitsluitend belbus/Flex-haltes. Snapshot opgehaald op 27 oktober 2026; bron-URL en ophaaltijd staan in het JSON-bestand. Ververs met `node scripts/update-delijn-stops.mjs`, bouw en publiceer opnieuw. Er is geen automatische dagelijkse update ingericht.

Vertrekken/ritten komen uit de publiek toegankelijke websitebackend van [De Lijn](https://www.delijn.be/):

```
/api/networktrips/stops/{stopCode}/?type=MERGEFLEX&detoursPolicy=filterDetours&enrichmentType=LINEDIRECTIONS
/api/networktrips/{tripId}/?type=MERGEFLEX
```

Dit zijn **ongedocumenteerde website-interfaces**, geen ondersteund OpenData-API-contract of SLA. Ze werkten zonder sleutels/cookies bij implementatie; ze kunnen veranderen of ontoegankelijk worden. De code valideert het schema en meldt provideruitval zichtbaar. Voor duurzaam grootschalig gebruik: vervang de adapter door gecontracteerde toegang via het De Lijn Open Data-portaal. Er zijn geen website-API-sleutels gekopieerd.

## Server en privacy

De bestaande React/Vite-app draait nu samen met een kleine Cloudflare Worker (`worker/index.ts`) via dezelfde Sites-host. De Worker staat alleen vaste endpoints en gevalideerde identifiers toe, is geen open URL-proxy en stuurt geen browsercookies of accountheaders door. Upstream `no-store` wordt behouden; De Lijn-vertrekdata worden niet in IndexedDB of edge-cache bewaard. Het geopende vertrekbord ververst om de minuut; polling stopt bij verlaten van de pagina en loopt niet door op de achtergrond.

NMBS blijft rechtstreeks via iRail bereikbaar. Voor de De Lijn-proxy zijn geen lokale Express-server of frontendsecrets nodig. `npm run dev` start de volledige app inclusief Worker; `npm run build` levert `dist/client` en `dist/server`. Publicatie vereist beide, plus `.openai/hosting.json`; een uitsluitend statische host ondersteunt de De Lijn-koppeling niet.

## Gegevensregels

- Epochs van De Lijn zijn al milliseconden; geen tweede vermenigvuldiging.
- Vertraging alleen afgeleid wanneer REALTIME en een realtime departure-epoch aanwezig zijn; anders `null` en “Gepland”.
- `merged`-passage: DELETED betekent afgeschaft. Andere passage: passageStatus CANCELLED. scheduleType NOT_SERVED betekent niet bediend. DEPARTED betekent vertrokken.
- Stoplijst: isPassed, isDeleted en isNotServed worden letterlijk verwerkt. isRealtime plus realtimePassageTime bepaalt de realtimevertraging.
- `exploitationDate` blijft bij de geselecteerde rit, ook na middernacht. Trip-id wordt exact uit de bron overgenomen.

## Validatie

Contracttests met echte broncaptures, regressies voor eindhaltes/NOBOARDING/afschaffingen/vertrokken ritten, proxyvalidatie en uitval. Browsertests controleren De Lijn zoeken → lijnfilter → specifieke rit → Mijn lijn op desktop en mobiel formaat. Live bronverzoeken zijn daarnaast met de werkelijke lokale Worker getest.


## Routegeometrie en gecombineerde planner (28 oktober 2026)

De ritkaart haalt het actuele `patternId` uit de rit op en gebruikt `/api/patterns/?ids=...` van De Lijn. De bron levert [latitude, longitude]; de kaart zet dit expliciet om naar GeoJSON. Geen rechte lijn als vervanging wanneer geometrie ontbreekt.

De planner gebruikt dezelfde publieke `/api/here/routes/` webdienst als de De Lijn-website, via een begrensde Worker-proxy. De aanvraag omvat trein, bus, tram en metro; wandelstukken en overstappen komen uit de bron. Vertrek- en aankomsttijd worden in Europe/Brussels geïnterpreteerd. HERE Flexible Polyline v1 wordt gedecodeerd per reisdeel. Blauw = trein, goud = bus/tram, grijs gestippeld = lopen. Een kaartfilter toont het gekozen reisdeel.

Dit is een publieke website-interface zonder gegarandeerde SLA; upstream fouten worden zichtbaar gemeld. Geen geheimen of sleutels uit de website worden gebruikt. Reisadviezen worden niet als live GPS gepresenteerd. De planner geeft geen betrouwbare NMBS/De Lijn voertuig-ID voor rittracking: er worden geen nep-ID’s gemaakt. Via vertrekborden blijft rittracking beschikbaar.

Gecontroleerd met echte Gent-Sint-Pieters → Wilrijk-reisadviezen, inclusief IC + bus 18 + bus 22, en fixtures daarvan in tests. Geometrie en dienstregeling kunnen veranderen; controleer de bronborden voor de actuele situatie.


## Persoonlijk ritdeel en GPS (28 oktober 2026)
Instap- en uitstaphalte worden per rit bewaard. GPS-keuze zoekt lokaal de dichtstbijzijnde instaphalte (max. 1,5 km, nauwkeurigheid max. 500 m). Afgeronde ritten worden na gebruikersbevestiging eenmaal geteld; afstand langs routegeometrie, anders expliciet een schatting via haltes. Profiel en reisplan staan lokaal in IndexedDB met localStorage-spiegel. Geen cloudsynchronisatie; verwijderen van websitegegevens wist ze.

Bij heropenen, pageshow, online en zichtbaarheid wordt de rit opnieuw opgehaald. Het opgeslagen plan heeft geen live voertuigpositie, vertragingen of vertrokken-status. iOS mag webapps onderbreken; bij uitgeschakeld toestel zijn geen live updates of achtergrond-GPS mogelijk. Kilometers blijven berekenbaar zonder de hele reis een actieve browser nodig te hebben.

De Lijn publiceert een voertuigstream via /api/vehicle/{vehicleId}/. De Worker controleert exact de publieke streamhost en het voertuigpad en geeft SSE door. De client accepteert uitsluitend het actuele rit- én voertuig-ID, geldige coördinaten en meettijd. Metingen ouder dan 90 s zijn laatst bekend, ouder dan 5 min worden verborgen. Verbindingen sluiten als de pagina verborgen wordt en openen opnieuw bij terugkeer. De marker is echte brondata, geen interpolatie.
