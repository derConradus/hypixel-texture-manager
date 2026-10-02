import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './style.css';
import type { Item, Project, Source } from './types';
import { loadServer } from './server';
import { readLocalPack, type LocalPack } from './local';

function merge(items: Item[]) {
    const itemMap = new Map<string, Item>();
    for (const item of items) {
        const existingItem = itemMap.get(item.id);
        if (existingItem) existingItem.variants.push(...item.variants);
        else itemMap.set(item.id, { ...item, variants: [...item.variants] });
    }
    return [...itemMap.values()];
}

function App() {
    const [sources, setSources] = useState<Source[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [localPacks, setLocalPacks] = useState<Record<string, LocalPack>>({});
    const [baseSourceId, setBaseSourceId] = useState('');
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [openItem, setOpenItem] = useState<Item | null>(null);
    const localPackInput = useRef<HTMLInputElement>(null);
    const projectInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadServer().then(result => {
            setSources(result.sources);
            setItems(merge(result.items));
            setBaseSourceId(result.sources[0]?.id || '');
        }).catch(console.error);
    }, []);

    const filteredItems = useMemo(
        () => items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [items, searchQuery]
    );

    const getSelectedVariant = (item: Item) =>
        item.variants.find(variant => variant.id === selectedVariants[item.id]) ||
        item.variants.find(variant => variant.sourceId === baseSourceId) ||
        item.variants[0];

    async function addLocalPacks(files: FileList | null) {
        for (const file of [...(files || [])]) {
            const result = await readLocalPack(file);
            setSources(current => [...current, result.pack.source]);
            setLocalPacks(current => ({ ...current, [result.pack.source.id]: result.pack }));
            setItems(current => merge([...current, ...result.items]));
        }
    }

    function saveProject() {
        const overrides: Project['overrides'] = {};
        for (const [itemId, variantId] of Object.entries(selectedVariants)) {
            const item = items.find(current => current.id === itemId);
            const variant = item?.variants.find(current => current.id === variantId);
            if (variant) overrides[itemId] = { sourceId: variant.sourceId, variantId };
        }
        const project: Project = {
            format: 'texture-picker-project',
            version: 1,
            name: 'My Texture Pack',
            baseSourceId,
            sources: sources.map(source => ({ id: source.id, name: source.name, kind: source.kind })),
            overrides
        };
        saveAs(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'texture-project.json');
    }

    async function loadProject(file?: File) {
        if (!file) return;
        const project = JSON.parse(await file.text()) as Project;
        setBaseSourceId(project.baseSourceId);
        setSelectedVariants(Object.fromEntries(
            Object.entries(project.overrides).map(([itemId, override]) => [itemId, override.variantId])
        ));
        const missingLocalPacks = project.sources.filter(
            source => source.kind === 'local' && !sources.some(current => current.id === source.id)
        );
        if (missingLocalPacks.length) {
            alert('Local packs must be added again: ' + missingLocalPacks.map(source => source.name).join(', '));
        }
    }

    async function buildPack() {
        const zip = new JSZip();
        zip.file('pack.mcmeta', JSON.stringify({
            pack: { pack_format: 48, description: 'Created with Texture Pack Builder' }
        }, null, 2));

        for (const item of items) {
            const variant = getSelectedVariant(item);
            if (!variant) continue;
            for (const asset of variant.assets) {
                let blob: Blob | undefined;
                if (asset.url) blob = await fetch(asset.url).then(response => response.blob());
                else if (asset.zipPath) blob = await localPacks[variant.sourceId]?.zip.file(asset.zipPath)?.async('blob');
                if (blob) zip.file(asset.path, blob);
            }
        }
        saveAs(await zip.generateAsync({ type: 'blob' }), 'My-Texture-Pack.zip');
    }

    return <>
        <header>
            <b>Texture Pack Builder</b>
            <input placeholder="Search items..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
            <button onClick={() => localPackInput.current?.click()}>+ Local Pack</button>
            <button onClick={saveProject}>Save JSON</button>
            <button onClick={() => projectInput.current?.click()}>Load JSON</button>
            <button className="primary" onClick={buildPack}>Build Pack</button>
        </header>
        <aside>
            <h3>Base Pack</h3>
            {sources.map(source => <label key={source.id}>
                <input type="radio" checked={baseSourceId === source.id} onChange={() => setBaseSourceId(source.id)} />
                {source.kind === 'local' ? '🔒' : '🌐'} {source.name}
            </label>)}
            <input hidden multiple type="file" accept=".zip" ref={localPackInput} onChange={event => addLocalPacks(event.target.files)} />
            <input hidden type="file" accept=".json" ref={projectInput} onChange={event => loadProject(event.target.files?.[0])} />
        </aside>
        <main>
            {filteredItems.map(item => {
                const variant = getSelectedVariant(item);
                return <button className="card" key={item.id} onClick={() => setOpenItem(item)}>
                    {variant?.preview ? <img src={variant.preview} alt={item.name} /> : <div className="placeholder">?</div>}
                    <strong>{item.name}</strong>
                    <small>{sources.find(source => source.id === variant?.sourceId)?.name || 'No source'}</small>
                </button>;
            })}
        </main>
        {openItem && <div className="backdrop" onClick={() => setOpenItem(null)}>
            <section className="modal" onClick={event => event.stopPropagation()}>
                <button className="close" onClick={() => setOpenItem(null)}>✕</button>
                <h2>{openItem.name}</h2>
                <div className="variants">
                    {openItem.variants.map(variant => <button
                        key={variant.id}
                        className={'variant ' + (getSelectedVariant(openItem)?.id === variant.id ? 'active' : '')}
                        onClick={() => {
                            setSelectedVariants(current => ({ ...current, [openItem.id]: variant.id }));
                            setOpenItem(null);
                        }}
                    >
                        {variant.preview ? <img src={variant.preview} alt={variant.label} /> : <div className="placeholder">?</div>}
                        <b>{sources.find(source => source.id === variant.sourceId)?.name}</b>
                        <small>{variant.label}</small>
                    </button>)}
                </div>
            </section>
        </div>}
    </>;
}

createRoot(document.getElementById('root')!).render(<App />);
