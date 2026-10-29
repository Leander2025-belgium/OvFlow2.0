# Acceptatiematrix

Update: NMBS en De Lijn werken voor haltes, vertrekken en ritten. Zie [De Lijn](DE-LIJN.md). De oorspronkelijke opdracht is nog niet volledig gerealiseerd.

| Criterium | Resultaat |
|---|---|
| Echte nabijgelegen haltes | Gedeeltelijk: echte NMBS-stations en De Lijn-bus/tramhaltes; geen TEC/MIVB |
| Vijf dichtbij met vertrekken | Gerealiseerd voor NMBS en De Lijn, hemelsbreed; bronuitval expliciet gemeld |
| Belgische haltes zoeken | Gedeeltelijk: Belgische treinstations plus De Lijn-haltes/codes |
| Correcte locaties op kaart | Stationscoördinaten uit iRail en De Lijn-haltecoördinaten uit Digitaal Vlaanderen, clustering aanwezig |
| Oostende–Brussel | Live browsercheck geslaagd, zes verbindingen |
| Gecombineerde bus–treinreis | Niet gerealiseerd; OTP niet operationeel |
| Specifieke lijn en rit | Gedeeltelijk: concrete trein uit vertrekbord/route of De Lijn-bus/tramrit met lijnfilter |
| Mijn lijn echte informatie | Stoplijsten, tijden en vertrekflags uit iRail/De Lijn; geen GPS |
| Vertragingen | Getoond indien bron deze levert |
| Favorieten blijven behouden | IndexedDB; herstartregressietest aanwezig |
| iPhone en Android | Responsief; Chromium desktop/mobiele tests, geen fysieke apparatentests |
| Uitval zonder crash | Provider-foutpad in desktop/mobiele tests |
| Vijf pagina's navigeerbaar | Gerealiseerd en browsergetest |
| Geen niet-werkende knoppen | Aanwezige acties hebben werking; onbeschikbare diensten worden als tekst uitgelegd |
| Installeerbare PWA | Manifest, iconen en service worker gebouwd; fysieke installatie nog niet geverifieerd |

## Nog nodige productontwikkeling

Volledige multimodale adapterlaag, dagelijkse feed-updates, routegeometrie/wandelen, adreszoeken, toegankelijkheid, voertuigposities met betrouwbare meetdatum, actieve begeleiding en herplanning, vertrekalarmen, vier talen, account/syncserver, privacy-export/verwijdering, prestatietests met alle Belgische haltes en echte iOS/Android-QA.
