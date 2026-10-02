# Texture Pack Builder
 
Client-side React/TypeScript prototype. The server/CDN only provides the catalog, manifests, and requested assets. Local ZIP packs are read exclusively in the browser.
 
## Getting Started
 
```bash
npm install
npm run dev
```
 
## Server Packs
 
`public/packs/catalog.json` references the manifests.
 
Each manifest contains `items[]`, whose `variants[]` may each contain `preview` and `assets`.
 
URL paths are relative to the manifest.
 
Example asset:
 
```json
{
"path": "assets/minecraft/textures/item/diamond_sword.png",
"url": "assets/minecraft/textures/item/diamond_sword.png"
}
```
 
## Current Status
 
The local importer currently detects vanilla files under:
 
- `assets/minecraft/textures/item`
- `assets/minecraft/textures/block`
 
The architecture supports multiple local ZIP packs.
 
For Hypixel SkyBlock, the next step is to implement version-dependent adapters for the respective custom item systems.
 
The exporter always copies all assets of a selected variant.
 
`pack_format` in the MVP is currently set to `48` and must be generated from a version matrix for production-ready version support.