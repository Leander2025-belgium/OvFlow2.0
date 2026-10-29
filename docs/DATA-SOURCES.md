# Databronnen en toegang

Onderzoek: 26–27 oktober 2026. iRail en De Lijn zijn aangesloten. De nieuwe De Lijn-adapter gebruikt de publieke websitebackend; zie [De Lijn-integratie](DE-LIJN.md). De BMC-GTFS-RT-feed is nog niet aangesloten.

## iRail / NMBS

- Documentatie: https://docs.irail.be/
- Endpoints: `https://api.irail.be/v1/stations`, `/liveboard`, `/connections`, `/vehicle`, met `format=json`.
- Stations, verbindingen, vertrekbord en voertuigstoplijst daadwerkelijk opgehaald. CORS staat browserrequests toe; geen API-sleutel nodig.
- iRail is een onafhankelijke bron voor Belgische spoorinformatie, geen officiële NMBS-app.
- De gedocumenteerde limiet is 3 requests/seconde/IP met beperkte burst. De frontend cachet en spreidt verzoeken; gateway voor gedeeld verkeer aanbevolen.
- Productie heeft bronvermelding. Bronupdate, onbekende vertraging, afschaffing en offline snapshot zijn aparte begrippen.

## De Lijn, MIVB/STIB, TEC en NMBS via Belgian Mobility

Officiële catalogus: https://data.belgianmobility.io/en/data.html
Voorwaarden: https://data.belgianmobility.io/en/terms.html
De Lijn-portaal: https://data.delijn.be/

De gezamenlijke portal vermeldde bij onderzoek een anonieme discovery-laag (100 requests/dag, 10/minuut) en ruimere geregistreerde toegang. Verifieer huidige quota, licentie en de juiste subscription vóór productie. De eigen De Lijn-producten vereisen doorgaans een abonnement/API-key.

Actuele catalogusbasis ten tijde van onderzoek:

```
https://api-management-discovery-production.azure-api.net
/api/gtfs/feed/{operator}/static
operator: delijn, stibmivb, tec, nmbssncb
/api/gtfs/feed/{operator}/rt/trip-update
/api/gtfs/feed/{operator}/rt/alert
/api/gtfs/feed/tec/rt/vehicle-position
/api/datasets/stibmivb/rt/WaitingTimes
/api/datasets/stibmivb/rt/VehiclePositions
/api/datasets/stibmivb/rt/TravellersInformation
/api/datasets/stibmivb/static/StopDetails
/api/datasets/stibmivb/static/stopsByLine
```

`WaitingTimes`, NMBS trip updates en een TEC static ZIP antwoordden tijdens onderzoek succesvol zonder key. De JSON-responsen hadden geen CORS-header: een servercache/proxy is nodig. Niet alle operator/type-combinaties zijn beschikbaar; gebruik de catalogus en verzin geen endpoint. MIVB waiting times bevatten JSON-gecodeerde strings. De discoverylimieten zijn ongeschikt voor een onbeperkte livekaart; registreer geschikte toegang en cache gedeeld.

**Niet geïmplementeerd:** BMC-GTFS-RT-adapters voor deze vervoerders, feed-to-trip matching, automatisch vernieuwen van feeds en serverdeployment. De aanwezige GTFS-importer en gateway zijn voorbereidend werk, geen aangesloten vervoerders.

## Routering

- OpenTripPlanner: https://docs.opentripplanner.org/en/latest/Basic-Tutorial/
- Smart Mobility Planner: https://github.com/belgianmobility/nextmoov-smop-general

Geen stabiele ondersteunde openbare SMOP-route-API bevestigd. De onderzochte frontend verwees naar staging-diensten; deze zijn niet als productieafhankelijkheid gebruikt. OTP vereist eigen hosting, GTFS/OSM-import, realtime-updaters en versiecontrole. De statische Sites-host kan geen JVM-router draaien.

## Kaart

Kaartsoftware: MapLibre GL JS. Kaartgegevens © OpenStreetMap contributors: https://www.openstreetmap.org/copyright
Tegelvoorwaarden: https://operations.osmfoundation.org/policies/tiles/

De app toont de attributie en slaat kaarttegels niet massaal/offline op. Gebruik voor aanzienlijk productiegebruik een geschikte tegelprovider. De getekende lijnen zijn alleen schematische verbindingen tussen door iRail geleverde haltes, geen berekende geometrie.
