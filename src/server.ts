import type { Item, Source } from "./types";
export async function loadServer() {
  const c = await fetch('/packs/catalog.json').then(r => r.json());
  const sources: Source[] = c.packs.map((p: any, i: number) => ({ id: p.id, name: p.name, kind: 'server', base: i === 0 }));
  const groups = await Promise.all(c.packs.map(async (p: any) => {
    const manifestUrl = new URL(p.manifest, location.href);
    const m = await fetch(manifestUrl).then(r => r.json());
    return (m.items as Item[]).map(x => ({
      ...x,
      variants: x.variants.map(v => ({
        ...v,
        sourceId: p.id,
        preview: v.preview ? new URL(v.preview, manifestUrl).href : undefined,
        assets: v.assets.map(a => ({ ...a, url: a.url ? new URL(a.url, manifestUrl).href : undefined }))
      }))
    }));
  }));
  return { sources, items: groups.flat() };
}
