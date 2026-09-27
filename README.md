# Texture Pack Builder

Clientseitiger React/TypeScript-Prototyp. Server/CDN liefert nur Katalog, Manifeste und die angeforderten Assets. Lokale ZIP-Packs werden ausschließlich im Browser gelesen.

## Start
```bash
npm install
npm run dev
```

## Server-Packs
`public/packs/catalog.json` referenziert Manifeste. Jedes Manifest enthält `items[]`, deren `variants[]` jeweils `preview` und `assets` haben können. URL-Pfade sind relativ zum Manifest.

Beispiel-Asset: `{"path":"assets/minecraft/textures/item/diamond_sword.png","url":"assets/minecraft/textures/item/diamond_sword.png"}`.

## Wichtiger Stand
Der lokale Import erkennt derzeit Vanilla-Dateien unter `assets/minecraft/textures/item` und `block`. Die Architektur erlaubt mehrere lokale ZIPs. Für Hypixel SkyBlock braucht es als nächsten Schritt versionsabhängige Adapter für die jeweiligen Custom-Item-Verfahren. Der Export kopiert immer alle Assets einer gewählten Variante.

`pack_format` im MVP ist momentan 48 und muss für produktiven Version-Support aus einer Versionsmatrix erzeugt werden.
