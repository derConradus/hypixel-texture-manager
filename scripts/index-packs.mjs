import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PACKS_DIR = path.join(ROOT, "public", "packs");
const CATALOG_FILE = path.join(PACKS_DIR, "catalog.json");

const IMAGE_EXTENSIONS = new Set([".png"]);

/*
 * Helper Functions
 */

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function normalizePath(filePath) {
    return filePath.split(path.sep).join("/");
}

function removeExtension(fileName) {
    return fileName.replace(/\.[^.]+$/u, "");
}

function prettifyName(name) {
    return removeExtension(name)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
}

function sanitizeId(value) {
    return value
        .toLowerCase()
        .replace(/\\/g, "/")
        .replace(/[^a-z0-9_./:-]+/g, "_")
        .replace(/_+/g, "_");
}

async function walk(directory) {
    const result = [];

    async function scan(current) {
        const entries = await fs.readdir(current, {
            withFileTypes: true
        });

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else {
                result.push(fullPath);
            }
        }
    }

    await scan(directory);
    return result;
}

/*
 * Read pack-info.json
 */

async function readPackInfo(packDirectory) {
    const infoFile = path.join(packDirectory, "pack-info.json");

    if (!(await exists(infoFile))) {
        return {};
    }

    try {
        const content = await fs.readFile(infoFile, "utf8");
        return JSON.parse(content);
    } catch (error) {
        console.warn("  WARNING: Could not read pack-info.json");
        console.warn(`  ${error.message}`);
        return {};
    }
}

/*
 * .properties Parser
 */

function parseProperties(content) {
    const properties = {};

    // Handle continuation lines
    const physicalLines = content.replace(/\r/g, "").split("\n");
    const lines = [];
    let current = "";

    for (const line of physicalLines) {
        const trimmedEnd = line.replace(/\s+$/u, "");

        if (trimmedEnd.endsWith("\\")) {
            current += trimmedEnd.slice(0, -1);
            continue;
        }

        current += trimmedEnd;
        lines.push(current);
        current = "";
    }

    if (current) {
        lines.push(current);
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) continue;
        if (line.startsWith("#") || line.startsWith("!")) continue;

        let separator = line.indexOf("=");
        if (separator === -1) separator = line.indexOf(":");
        if (separator === -1) continue;

        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        properties[key] = value;
    }

    return properties;
}

/*
 * Vanilla Minecraft
 */

function createVanillaItem(relativePath, packId) {
    const normalized = normalizePath(relativePath);
    const match = normalized.match(
        /^assets\/minecraft\/textures\/(item|items|block|blocks)\/(.+)\.png$/i
    );

    if (!match) return null;

    const originalFolder = match[1].toLowerCase();
    const resourceName = match[2];
    const category = originalFolder === "item" || originalFolder === "items"
        ? "item"
        : "block";

    const fileName = path.posix.basename(resourceName);
    const name = prettifyName(fileName);
    const publicUrl = `/packs/${packId}/${normalized}`;

    return {
        id: `minecraft:${category}/${resourceName}`,
        name,
        category,
        type: "minecraft",
        variants: [{
            id: `${packId}:minecraft:${category}/${resourceName}`,
            label: name,
            sourceId: packId,
            preview: publicUrl,
            assets: [{
                path: normalized,
                url: publicUrl
            }]
        }]
    };
}

/*
 * CIT (Custom Item Texture) Recognition
 */

function isCitPath(relativePath) {
    const normalized = normalizePath(relativePath).toLowerCase();
    return normalized.includes("/mcpatcher/cit/") || normalized.includes("/optifine/cit/");
}

function findPropertyCaseInsensitive(properties, possibleNames) {
    const entries = Object.entries(properties);

    for (const possibleName of possibleNames) {
        const lower = possibleName.toLowerCase();
        const match = entries.find(([key]) => key.toLowerCase() === lower);
        if (match) return match[1];
    }

    return undefined;
}

function findCitTextureProperty(properties) {
    if (properties.texture) return properties.texture;

    for (const [key, value] of Object.entries(properties)) {
        if (key.toLowerCase().startsWith("texture.")) return value;
    }

    return null;
}

function getCitMinecraftItem(properties) {
    return findPropertyCaseInsensitive(properties, [
        "items", "item", "matchItems", "matchitems"
    ]);
}

function getCitDisplayName(properties) {
    for (const [key, value] of Object.entries(properties)) {
        const lower = key.toLowerCase();

        if (
            lower === "nbt.display.name" ||
            lower === "components.minecraft:custom_name" ||
            lower.includes("display.name")
        ) {
            return value;
        }
    }

    return null;
}

function cleanCitDisplayName(value) {
    if (!value) return null;

    let result = value;
    result = result.replace(/^(ipattern|pattern|regex|iregex):/i, "");
    result = result
        .replace(/\\(.)/g, "$1")
        .replace(/\*/g, "")
        .replace(/\?/g, "")
        .trim();

    return result || null;
}

function cleanSkyBlockId(value) {
    if (!value) return null;

    return value
        .replace(/\\/g, "")
        .replace(/^minecraft:/i, "")
        .replace(/^(ipattern|pattern|iregex|regex):/i, "")
        .replace(/\*/g, "")
        .replace(/\?/g, "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getExtraAttributesId(properties) {
    for (const [key, value] of Object.entries(properties)) {
        const normalizedKey = key.toLowerCase();

        if (
            normalizedKey === "nbt.extraattributes.id" ||
            normalizedKey.endsWith(".extraattributes.id")
        ) {
            return cleanSkyBlockId(value);
        }
    }

    return null;
}

function getSkyBlockId(properties, propertiesFile) {
    const extraAttributesId = getExtraAttributesId(properties);

    if (extraAttributesId) {
        return { id: extraAttributesId, confidence: "exact", source: "extraAttributes" };
    }

    const texture = findCitTextureProperty(properties);

    if (texture) {
        const cleanTexture = texture.replace(/\\/g, "").replace(/^minecraft:/i, "");
        const textureName = path.basename(cleanTexture);
        const id = cleanSkyBlockId(removeExtension(textureName));

        if (id) return { id, confidence: "texture", source: "texture" };
    }

    const displayName = getCitDisplayName(properties);

    if (displayName) {
        const cleanName = cleanCitDisplayName(displayName);
        const id = cleanSkyBlockId(cleanName);

        if (id) return { id, confidence: "name", source: "displayName" };
    }

    const fileName = path.basename(propertiesFile, ".properties");
    const id = cleanSkyBlockId(fileName);

    if (id) return { id, confidence: "filename", source: "filename" };
    return null;
}

/*
 * Resolve CIT Texture
 */

async function resolveCitTexture(propertiesFile, properties) {
    const directory = path.dirname(propertiesFile);
    const explicitTexture = findCitTextureProperty(properties);

    if (explicitTexture) {
        let textureName = explicitTexture.trim();
        textureName = textureName.replace(/^minecraft:/, "");

        if (!textureName.endsWith(".png")) textureName += ".png";

        const localCandidate = path.resolve(directory, textureName);
        if (await exists(localCandidate)) return localCandidate;

        const basenameCandidate = path.join(directory, path.basename(textureName));
        if (await exists(basenameCandidate)) return basenameCandidate;
    }

    const sameName = propertiesFile.replace(/\.properties$/i, ".png");
    if (await exists(sameName)) return sameName;

    return null;
}

/*
 * Generate CIT Item
 */

async function createCitItem(propertiesFile, packDirectory, packId) {
    let content;

    try {
        content = await fs.readFile(propertiesFile, "utf8");
    } catch {
        return null;
    }

    const properties = parseProperties(content);
    const textureFile = await resolveCitTexture(propertiesFile, properties);
    if (!textureFile) return null;

    const relativeTexture = normalizePath(path.relative(packDirectory, textureFile));
    const relativeProperties = normalizePath(path.relative(packDirectory, propertiesFile));
    const displayMatcher = getCitDisplayName(properties);
    const minecraftItem = getCitMinecraftItem(properties);
    const skyBlockIdentity = getSkyBlockId(properties, propertiesFile);

    if (!skyBlockIdentity) return null;

    const name = prettifyName(skyBlockIdentity.id);
    const logicalId = `skyblock:${skyBlockIdentity.id}`;
    const publicTextureUrl = `/packs/${packId}/${relativeTexture}`;
    const publicPropertiesUrl = `/packs/${packId}/${relativeProperties}`;

    return {
        id: logicalId,
        skyblockId: skyBlockIdentity.id,
        name,
        category: "skyblock",
        type: "cit",
        minecraftItem: minecraftItem || null,
        identity: {
            method: skyBlockIdentity.source,
            confidence: skyBlockIdentity.confidence
        },
        match: {
            displayName: displayMatcher || null
        },
        variants: [{
            id: `${packId}:${logicalId}`,
            label: name,
            sourceId: packId,
            preview: publicTextureUrl,
            assets: [
                { path: relativeTexture, url: publicTextureUrl },
                { path: relativeProperties, url: publicPropertiesUrl }
            ],
            cit: {
                properties: relativeProperties,
                minecraftItem: minecraftItem || null,
                displayName: displayMatcher || null
            }
        }]
    };
}

/*
 * Index CIT Definitions
 */

async function indexCitDefinitions(files, packDirectory, packId) {
    const items = [];
    let definitions = 0;
    let valid = 0;
    let withoutTexture = 0;

    for (const absoluteFile of files) {
        if (path.extname(absoluteFile).toLowerCase() !== ".properties") continue;

        const relativePath = normalizePath(path.relative(packDirectory, absoluteFile));
        if (!isCitPath(relativePath)) continue;

        definitions++;
        const item = await createCitItem(absoluteFile, packDirectory, packId);

        if (!item) {
            withoutTexture++;
            continue;
        }

        valid++;
        items.push(item);
    }

    return {
        items,
        stats: { definitions, valid, withoutTexture }
    };
}

/*
 * Merge Duplicate Items
 */

function mergeItems(items) {
    const itemMap = new Map();

    for (const item of items) {
        let targetItem = itemMap.get(item.id);

        if (!targetItem) {
            targetItem = { ...item, variants: [] };
            itemMap.set(item.id, targetItem);
        }

        for (const variant of item.variants) {
            let existingVariant = targetItem.variants.find(
                current => current.sourceId === variant.sourceId
            );

            if (!existingVariant) {
                existingVariant = { ...variant, assets: [...variant.assets] };
                targetItem.variants.push(existingVariant);
                continue;
            }

            for (const asset of variant.assets) {
                const alreadyExists = existingVariant.assets.some(
                    currentAsset => currentAsset.path === asset.path
                );

                if (!alreadyExists) existingVariant.assets.push(asset);
            }

            if (!existingVariant.preview && variant.preview) {
                existingVariant.preview = variant.preview;
            }
        }
    }

    return Array.from(itemMap.values());
}

/*
 * Manifest
 */

async function createManifest(packDirectory, packId) {
    const assetsDirectory = path.join(packDirectory, "assets");

    if (!(await exists(assetsDirectory))) {
        console.warn("  No assets/ directory found");

        return {
            version: 2,
            pack: { id: packId },
            generatedAt: new Date().toISOString(),
            stats: { vanilla: 0, cit: 0, total: 0 },
            items: []
        };
    }

    const files = await walk(assetsDirectory);

    /* Vanilla Textures */
    const vanillaItems = [];
    let pngFiles = 0;
    let ignoredPngFiles = 0;

    for (const absoluteFile of files) {
        const extension = path.extname(absoluteFile).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(extension)) continue;

        pngFiles++;
        const relativePath = path.relative(packDirectory, absoluteFile);
        const item = createVanillaItem(relativePath, packId);

        if (item) vanillaItems.push(item);
        else ignoredPngFiles++;
    }

    /* CIT Definitions */
    const citResult = await indexCitDefinitions(files, packDirectory, packId);

    /* Merge Items */
    const items = mergeItems([...vanillaItems, ...citResult.items]);
    items.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`  Total PNG files: ${pngFiles}`);
    console.log(`  Vanilla item/block textures: ${vanillaItems.length}`);
    console.log(`  CIT definitions: ${citResult.stats.definitions}`);
    console.log(`  CIT definitions successfully indexed: ${citResult.stats.valid}`);

    if (citResult.stats.withoutTexture > 0) {
        console.log(`  CIT definitions without resolvable texture: ${citResult.stats.withoutTexture}`);
    }

    console.log(`  Other PNG files: ${ignoredPngFiles}`);

    return {
        version: 2,
        pack: { id: packId },
        generatedAt: new Date().toISOString(),
        stats: {
            pngFiles,
            vanilla: vanillaItems.length,
            cit: citResult.items.length,
            citDefinitions: citResult.stats.definitions,
            citWithoutTexture: citResult.stats.withoutTexture,
            total: items.length
        },
        items
    };
}

/*
 * Pack Icon
 */

async function detectPackIcon(packDirectory) {
    const packPng = path.join(packDirectory, "pack.png");
    if (await exists(packPng)) return "pack.png";
    return null;
}

/*
 * Index Pack
 */

async function indexPack(entry) {
    const packId = entry.name;
    const packDirectory = path.join(PACKS_DIR, packId);

    console.log("");
    console.log(`Pack: ${packId}`);

    const info = await readPackInfo(packDirectory);
    const manifest = await createManifest(packDirectory, packId);
    const manifestFile = path.join(packDirectory, "manifest.json");

    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

    console.log(`  ${manifest.items.length} entries indexed`);
    console.log("  manifest.json created");

    const icon = await detectPackIcon(packDirectory);

    return {
        id: packId,
        name: info.name ?? prettifyName(packId),
        type: info.type ?? (manifest.stats.cit > 0 ? "hypixel-skyblock" : "minecraft"),
        minecraftVersion: info.minecraftVersion ?? null,
        description: info.description ?? "",
        stats: manifest.stats,
        ...(icon ? { icon: `/packs/${packId}/${icon}` } : {}),
        manifest: `/packs/${packId}/manifest.json`
    };
}

/*
 * Main
 */

async function main() {
    console.log("=====================================");
    console.log(" Minecraft / SkyBlock Pack Indexer");
    console.log("=====================================");
    console.log(`Pack directory: ${PACKS_DIR}`);

    if (!(await exists(PACKS_DIR))) {
        await fs.mkdir(PACKS_DIR, { recursive: true });
    }

    const entries = await fs.readdir(PACKS_DIR, { withFileTypes: true });
    const packs = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;

        const result = await indexPack(entry);
        packs.push(result);
    }

    packs.sort((a, b) => a.name.localeCompare(b.name));

    const catalog = {
        version: 2,
        generatedAt: new Date().toISOString(),
        packs
    };

    await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), "utf8");

    console.log("");
    console.log("=====================================");
    console.log(`${packs.length} packs indexed`);
    console.log(`catalog.json: ${CATALOG_FILE}`);
    console.log("=====================================");
}

main().catch(error => {
    console.error("");
    console.error("Error while creating the index:");
    console.error(error);
    process.exit(1);
});
