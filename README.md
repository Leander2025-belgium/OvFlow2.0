# OVFlow — GitHub-editie

Broncode van de versie van 29 oktober 2026, inclusief echte De Lijn-GPS, bus- en treinplanner, routegeometrie, instap-/uitstaphaltes en lokaal opgeslagen kilometers. Deze export is losgemaakt van de oorspronkelijke Sites-hosting.

## Lokaal starten

Installeer Node.js 22.13 of hoger. Open een terminal in deze map:

```sh
npm ci
npm run dev
```

Open de URL uit de terminal.

## Uploaden naar GitHub

Pak de zip uit. Maak een lege GitHub-repository en upload de inhoud van deze map, inclusief de puntbestanden zoals `.gitignore`. `package.json` moet in de hoofdmap van je repository staan. Je hoeft geen `node_modules` te uploaden.

## Online gebruiken via Cloudflare Workers

GitHub bewaart de code; GitHub Pages alleen is onvoldoende omdat de planner en De Lijn een servercomponent gebruiken. De meegeleverde configuratie bouwt de website en Worker samen.

Met een eigen Cloudflare-account, vanuit deze map:

```sh
npm ci
npx wrangler login
npm run deploy
```

Wrangler toont na publicatie je eigen website-URL. De naam is standaard `ovflow`, aanpasbaar in `vite.config.ts`. Je eigen publicatie is standaard publiek; de privétoegang van de oorspronkelijke Sites-website wordt niet meegenomen. Deze export is lokaal gebouwd; er is niet naar jouw Cloudflare-account gepubliceerd.

Je kunt de GitHub-repository ook aan Cloudflare Workers Builds koppelen: buildopdracht `npm run build`, deployopdracht `npx wrangler deploy --config dist/server/wrangler.json`.

## iPhone

Open je HTTPS-website in Safari en kies Delen → Zet op beginscherm. De livepagina toont GPS wanneer De Lijn voor de gekozen huidige rit metingen doorgeeft. Bij uitgeschakelde telefoon of geschorste webapp zijn er geen live updates; de opgeslagen rit kan bij terugkeer hervat worden.

## Gegevens en beperkingen

- Profiel, haltekeuze en kilometers worden lokaal op het apparaat opgeslagen, niet in GitHub of een cloudaccount.
- Een nieuwe domeinnaam heeft een aparte lokale opslag. Bestaande kilometers van de oude website worden niet automatisch overgezet.
- Providerdiensten en openbare endpoints kunnen wijzigen of tijdelijk uitvallen. Er worden geen voertuigposities verzonnen.
- Historische documenten in `docs/` beschrijven eerdere implementatiefasen en kunnen oudere beperkingen noemen. Deze README beschrijft deze export.
- `.env.example` en `server/` zijn voor de optionele oudere Node/OTP-gateway; die is niet nodig voor de ingebouwde Worker.

## Controle

```sh
npm test
npm run build
```

Browserregressietests: `npx playwright install chromium` en `npm run test:e2e`.
