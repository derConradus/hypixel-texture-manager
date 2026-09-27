import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PACKS_DIR = path.join(ROOT, "public", "packs");
const CATALOG_FILE = path.join(PACKS_DIR, "catalog.json");

const IMAGE_EXTENSIONS = new Set([".png"]);

/*
 * ============================================================
 * Hilfsfunktionen
 * ============================================================
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
            const fullPath = path.join(
                current,
                entry.name
            );

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
 * ============================================================
 * pack-info.json
 * ============================================================
 */

async function readPackInfo(packDirectory) {
    const infoFile = path.join(
        packDirectory,
        "pack-info.json"
    );

    if (!(await exists(infoFile))) {
        return {};
    }

    try {
        const content = await fs.readFile(
            infoFile,
            "utf8"
        );

        return JSON.parse(content);
    } catch (error) {
        console.warn(
            `  WARNUNG: pack-info.json konnte nicht gelesen werden`
        );

        console.warn(`  ${error.message}`);

        return {};
    }
}

/*
 * ============================================================
 * .properties Parser
 * ============================================================
 */

function parseProperties(content) {
    const properties = {};

    // Fortsetzungszeilen behandeln
    const physicalLines = content
        .replace(/\r/g, "")
        .split("\n");

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

        if (!line) {
            continue;
        }

        if (
            line.startsWith("#") ||
            line.startsWith("!")
        ) {
            continue;
        }

        let separator = line.indexOf("=");

        if (separator === -1) {
            separator = line.indexOf(":");
        }

        if (separator === -1) {
            continue;
        }

        const key = line
            .slice(0, separator)
            .trim();

        const value = line
            .slice(separator + 1)
            .trim();

        properties[key] = value;
    }

    return properties;
}

/*
 * ============================================================
 * Vanilla Minecraft
 * ============================================================
 */

function createVanillaItem(
    relativePath,
    packId
) {
    const normalized =
        normalizePath(relativePath);

    /*
     * Unterstützt:
     *
     * textures/item/
     * textures/items/
     * textures/block/
     * textures/blocks/
     */

    const match = normalized.match(
        /^assets\/minecraft\/textures\/(item|items|block|blocks)\/(.+)\.png$/i
    );

    if (!match) {
        return null;
    }

    const originalFolder =
        match[1].toLowerCase();

    const resourceName = match[2];

    let category;

    if (
        originalFolder === "item" ||
        originalFolder === "items"
    ) {
        category = "item";
    } else {
        category = "block";
    }

    const fileName =
        path.posix.basename(resourceName);

    const name =
        prettifyName(fileName);

    const publicUrl =
        `/packs/${packId}/${normalized}`;

    return {
        id:
            `minecraft:${category}/${resourceName}`,

        name,

        category,

        type: "minecraft",

        variants: [
            {
                id:
                    `${packId}:minecraft:${category}/${resourceName}`,

                label: name,

                sourceId: packId,

                preview: publicUrl,

                assets: [
                    {
                        path: normalized,
                        url: publicUrl
                    }
                ]
            }
        ]
    };
}

/*
 * ============================================================
 * CIT Erkennung
 * ============================================================
 */

function isCitPath(relativePath) {
    const normalized =
        normalizePath(relativePath).toLowerCase();

    return (
        normalized.includes(
            "/mcpatcher/cit/"
        ) ||
        normalized.includes(
            "/optifine/cit/"
        )
    );
}

function findPropertyCaseInsensitive(
    properties,
    possibleNames
) {
    const entries =
        Object.entries(properties);

    for (const possibleName of possibleNames) {
        const lower =
            possibleName.toLowerCase();

        const match = entries.find(
            ([key]) =>
                key.toLowerCase() === lower
        );

        if (match) {
            return match[1];
        }
    }

    return undefined;
}

function findCitTextureProperty(properties) {
    /*
     * Häufige Formate:
     *
     * texture=foo
     * texture=item/foo
     * texture.diamond_sword=foo
     */

    if (properties.texture) {
        return properties.texture;
    }

    for (
        const [key, value]
        of Object.entries(properties)
    ) {
        if (
            key.toLowerCase().startsWith(
                "texture."
            )
        ) {
            return value;
        }
    }

    return null;
}

function getCitMinecraftItem(properties) {
    return findPropertyCaseInsensitive(
        properties,
        [
            "items",
            "item",
            "matchItems",
            "matchitems"
        ]
    );
}

function getCitDisplayName(properties) {
    /*
     * Beispiele:
     *
     * nbt.display.Name
     * nbt.display.name
     */

    for (
        const [key, value]
        of Object.entries(properties)
    ) {
        const lower =
            key.toLowerCase();

        if (
            lower ===
            "nbt.display.name" ||
            lower ===
            "components.minecraft:custom_name" ||
            lower.includes(
                "display.name"
            )
        ) {
            return value;
        }
    }

    return null;
}

function cleanCitDisplayName(value) {
    if (!value) {
        return null;
    }

    let result = value;

    /*
     * OptiFine-Matcher entfernen
     *
     * ipattern:
     * pattern:
     * regex:
     * iregex:
     */

    result = result.replace(
        /^(ipattern|pattern|regex|iregex):/i,
        ""
    );

    /*
     * einfache Wildcards
     */

    result = result
        .replace(/\\(.)/g, "$1")
        .replace(/\*/g, "")
        .replace(/\?/g, "")
        .trim();

    return result || null;
}

function cleanSkyBlockId(value) {
    if (!value) {
        return null;
    }

    return value
        // OptiFine escaping entfernen:
        // BUDGET\_HOPPER -> BUDGET_HOPPER
        .replace(/\\/g, "")

        // Minecraft Namespace entfernen
        .replace(/^minecraft:/i, "")

        // Matcher entfernen
        .replace(/^(ipattern|pattern|iregex|regex):/i, "")

        // Wildcards entfernen
        .replace(/\*/g, "")
        .replace(/\?/g, "")

        .trim()
        .toUpperCase()

        // Leerzeichen etc. zu "_"
        .replace(/[^A-Z0-9]+/g, "_")

        // mehrfache "_" zusammenfassen
        .replace(/_+/g, "_")

        // "_" am Anfang/Ende entfernen
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
    /*
    * Priorität 1:
    *
    * nbt.ExtraAttributes.id=BUDGET\_HOPPER
    */

    const extraAttributesId =
        getExtraAttributesId(properties);

    if (extraAttributesId) {
        return {
            id: extraAttributesId,
            confidence: "exact",
            source: "extraAttributes"
        };
    }

    /*
    * Priorität 2:
    *
    * texture=budget\_hopper
    */

    const texture =
        findCitTextureProperty(properties);

    if (texture) {
        const cleanTexture = texture
            .replace(/\\/g, "")
            .replace(/^minecraft:/i, "");

        const textureName =
            path.basename(cleanTexture);

        const id =
            cleanSkyBlockId(
                removeExtension(textureName)
            );

        if (id) {
            return {
                id,
                confidence: "texture",
                source: "texture"
            };
        }
    }

    /*
    * Priorität 3:
    *
    * nbt.display.Name=ipattern:*budget hopper*
    */

    const displayName =
        getCitDisplayName(properties);

    if (displayName) {
        const cleanName =
            cleanCitDisplayName(displayName);

        const id =
            cleanSkyBlockId(cleanName);

        if (id) {
            return {
                id,
                confidence: "name",
                source: "displayName"
            };
        }
    }

    /*
    * Priorität 4:
    * Dateiname
    */

    const fileName =
        path.basename(
            propertiesFile,
            ".properties"
        );

    const id =
        cleanSkyBlockId(fileName);

    if (id) {
        return {
            id,
            confidence: "filename",
            source: "filename"
        };
    }

    return null;
}

/*
 * ============================================================
 * CIT Texture auflösen
 * ============================================================
 */

async function resolveCitTexture(
    propertiesFile,
    properties
) {
    const directory =
        path.dirname(propertiesFile);

    const explicitTexture =
        findCitTextureProperty(properties);

    if (explicitTexture) {
        let textureName =
            explicitTexture.trim();

        textureName =
            textureName.replace(
                /^minecraft:/,
                ""
            );

        if (!textureName.endsWith(".png")) {
            textureName += ".png";
        }

        /*
         * Zuerst relativ zur .properties-Datei.
         */

        const localCandidate =
            path.resolve(
                directory,
                textureName
            );

        if (await exists(localCandidate)) {
            return localCandidate;
        }

        /*
         * Manche CIT-Dateien benutzen nur den Dateinamen.
         */

        const basenameCandidate =
            path.join(
                directory,
                path.basename(textureName)
            );

        if (
            await exists(
                basenameCandidate
            )
        ) {
            return basenameCandidate;
        }
    }

    /*
     * Standard:
     *
     * hyperion.properties
     * hyperion.png
     */

    const sameName =
        propertiesFile.replace(
            /\.properties$/i,
            ".png"
        );

    if (await exists(sameName)) {
        return sameName;
    }

    return null;
}

/*
 * ============================================================
 * CIT Item erzeugen
 * ============================================================
 */

async function createCitItem(
    propertiesFile,
    packDirectory,
    packId
) {
    let content;

    try {
        content = await fs.readFile(
            propertiesFile,
            "utf8"
        );
    } catch {
        return null;
    }

    const properties =
        parseProperties(content);

    const textureFile =
        await resolveCitTexture(
            propertiesFile,
            properties
        );

    if (!textureFile) {
        return null;
    }

    const relativeTexture =
        normalizePath(
            path.relative(
                packDirectory,
                textureFile
            )
        );

    const relativeProperties =
        normalizePath(
            path.relative(
                packDirectory,
                propertiesFile
            )
        );

    const fileName =
        path.basename(
            propertiesFile,
            ".properties"
        );

    const displayMatcher =
        getCitDisplayName(properties);

    const cleanedDisplayName =
        cleanCitDisplayName(
            displayMatcher
        );



    const minecraftItem =
        getCitMinecraftItem(
            properties
        );

    /*
     * Für SkyBlock benutzen wir bewusst nicht einfach
     * minecraft:diamond_sword als ID.
     *
     * Zwei komplett unterschiedliche SkyBlock Items können
     * denselben Vanilla-Gegenstand als Basis benutzen.
     */

    const relativeDefinition =
        normalizePath(
            path.relative(
                path.join(
                    packDirectory,
                    "assets"
                ),
                propertiesFile
            )
        );

    const skyBlockIdentity =
        getSkyBlockId(
            properties,
            propertiesFile
        );

    if (!skyBlockIdentity) {
        return null;
    }

    const name =
        prettifyName(
            skyBlockIdentity.id
        );

    const logicalId =
        `skyblock:${skyBlockIdentity.id}`;

    const publicTextureUrl =
        `/packs/${packId}/${relativeTexture}`;

    const publicPropertiesUrl =
        `/packs/${packId}/${relativeProperties}`;

    return {
        id: logicalId,

        skyblockId:
            skyBlockIdentity.id,

        name,

        category: "skyblock",

        type: "cit",

        minecraftItem:
            minecraftItem || null,

        identity: {
            method:
                skyBlockIdentity.source,

            confidence:
                skyBlockIdentity.confidence
        },

        match: {
            displayName:
                displayMatcher || null
        },

        variants: [
            {
                id:
                    `${packId}:${logicalId}`,

                label: name,

                sourceId: packId,

                preview:
                    publicTextureUrl,

                assets: [
                    {
                        path:
                            relativeTexture,

                        url:
                            publicTextureUrl
                    },

                    {
                        path:
                            relativeProperties,

                        url:
                            publicPropertiesUrl
                    }
                ],

                cit: {
                    properties:
                        relativeProperties,

                    minecraftItem:
                        minecraftItem || null,

                    displayName:
                        displayMatcher || null
                }
            }
        ]
    };
}

/*
 * ============================================================
 * CIT Definitions indexieren
 * ============================================================
 */

async function indexCitDefinitions(
    files,
    packDirectory,
    packId
) {
    const items = [];

    let definitions = 0;
    let valid = 0;
    let withoutTexture = 0;

    for (const absoluteFile of files) {
        if (
            path.extname(
                absoluteFile
            ).toLowerCase() !==
            ".properties"
        ) {
            continue;
        }

        const relativePath =
            normalizePath(
                path.relative(
                    packDirectory,
                    absoluteFile
                )
            );

        if (!isCitPath(relativePath)) {
            continue;
        }

        definitions++;

        const item =
            await createCitItem(
                absoluteFile,
                packDirectory,
                packId
            );

        if (!item) {
            withoutTexture++;
            continue;
        }

        valid++;
        items.push(item);
    }

    return {
        items,
        stats: {
            definitions,
            valid,
            withoutTexture
        }
    };
}

/*
 * ============================================================
 * Duplikate / Items zusammenführen
 * ============================================================
 */

function mergeItems(items) {
    const itemMap = new Map();

    for (const item of items) {
        let targetItem =
            itemMap.get(item.id);

        if (!targetItem) {
            targetItem = {
                ...item,
                variants: []
            };

            itemMap.set(
                item.id,
                targetItem
            );
        }

        for (const variant of item.variants) {
            /*
            * Gleiche SkyBlock-ID + gleiches Pack
            * sollen eine gemeinsame Variante werden.
            */

            let existingVariant =
                targetItem.variants.find(
                    current =>
                        current.sourceId ===
                        variant.sourceId
                );

            if (!existingVariant) {
                existingVariant = {
                    ...variant,
                    assets: [
                        ...variant.assets
                    ]
                };

                targetItem.variants.push(
                    existingVariant
                );

                continue;
            }

            /*
            * Assets hinzufügen ohne Duplikate.
            */

            for (const asset of variant.assets) {
                const alreadyExists =
                    existingVariant.assets.some(
                        currentAsset =>
                            currentAsset.path ===
                            asset.path
                    );

                if (!alreadyExists) {
                    existingVariant.assets.push(
                        asset
                    );
                }
            }

            /*
            * Preview beibehalten.
            */

            if (
                !existingVariant.preview &&
                variant.preview
            ) {
                existingVariant.preview =
                    variant.preview;
            }
        }
    }

    return Array.from(
        itemMap.values()
    );
}

/*
 * ============================================================
 * Manifest
 * ============================================================
 */

async function createManifest(
    packDirectory,
    packId
) {
    const assetsDirectory =
        path.join(
            packDirectory,
            "assets"
        );

    if (!(await exists(assetsDirectory))) {
        console.warn(
            "  Keine assets/ gefunden"
        );

        return {
            version: 2,

            pack: {
                id: packId
            },

            generatedAt:
                new Date().toISOString(),

            stats: {
                vanilla: 0,
                cit: 0,
                total: 0
            },

            items: []
        };
    }

    const files =
        await walk(
            assetsDirectory
        );

    /*
     * ----------------------------------------------------------
     * Vanilla
     * ----------------------------------------------------------
     */

    const vanillaItems = [];

    let pngFiles = 0;
    let ignoredPngFiles = 0;

    for (const absoluteFile of files) {
        const extension =
            path.extname(
                absoluteFile
            ).toLowerCase();

        if (
            !IMAGE_EXTENSIONS.has(
                extension
            )
        ) {
            continue;
        }

        pngFiles++;

        const relativePath =
            path.relative(
                packDirectory,
                absoluteFile
            );

        const item =
            createVanillaItem(
                relativePath,
                packId
            );

        if (item) {
            vanillaItems.push(item);
        } else {
            ignoredPngFiles++;
        }
    }

    /*
     * ----------------------------------------------------------
     * CIT
     * ----------------------------------------------------------
     */

    const citResult =
        await indexCitDefinitions(
            files,
            packDirectory,
            packId
        );

    /*
     * ----------------------------------------------------------
     * Zusammenführen
     * ----------------------------------------------------------
     */

    const items =
        mergeItems([
            ...vanillaItems,
            ...citResult.items
        ]);

    items.sort(
        (a, b) =>
            a.name.localeCompare(
                b.name
            )
    );

    console.log(
        `  PNG-Dateien insgesamt: ${pngFiles}`
    );

    console.log(
        `  Vanilla Item/Block Texturen: ${vanillaItems.length}`
    );

    console.log(
        `  CIT Definitionen: ${citResult.stats.definitions}`
    );

    console.log(
        `  CIT erfolgreich: ${citResult.stats.valid}`
    );

    if (
        citResult.stats
            .withoutTexture > 0
    ) {
        console.log(
            `  CIT ohne auflösbare Texture: ${citResult.stats.withoutTexture}`
        );
    }

    console.log(
        `  Andere PNG-Dateien: ${ignoredPngFiles}`
    );

    return {
        version: 2,

        pack: {
            id: packId
        },

        generatedAt:
            new Date().toISOString(),

        stats: {
            pngFiles,

            vanilla:
                vanillaItems.length,

            cit:
                citResult.items.length,

            citDefinitions:
                citResult.stats
                    .definitions,

            citWithoutTexture:
                citResult.stats
                    .withoutTexture,

            total:
                items.length
        },

        items
    };
}

/*
 * ============================================================
 * Pack Icon
 * ============================================================
 */

async function detectPackIcon(
    packDirectory
) {
    const packPng =
        path.join(
            packDirectory,
            "pack.png"
        );

    if (await exists(packPng)) {
        return "pack.png";
    }

    return null;
}

/*
 * ============================================================
 * Pack indexieren
 * ============================================================
 */

async function indexPack(entry) {
    const packId = entry.name;

    const packDirectory =
        path.join(
            PACKS_DIR,
            packId
        );

    console.log("");
    console.log(
        `Pack: ${packId}`
    );

    const info =
        await readPackInfo(
            packDirectory
        );

    const manifest =
        await createManifest(
            packDirectory,
            packId
        );

    const manifestFile =
        path.join(
            packDirectory,
            "manifest.json"
        );

    await fs.writeFile(
        manifestFile,
        JSON.stringify(
            manifest,
            null,
            2
        ),
        "utf8"
    );

    console.log(
        `  ${manifest.items.length} Einträge indexiert`
    );

    console.log(
        "  manifest.json erstellt"
    );

    const icon =
        await detectPackIcon(
            packDirectory
        );

    return {
        id: packId,

        name:
            info.name ??
            prettifyName(packId),

        type:
            info.type ??
            (
                manifest.stats.cit > 0
                    ? "hypixel-skyblock"
                    : "minecraft"
            ),

        minecraftVersion:
            info.minecraftVersion ??
            null,

        description:
            info.description ??
            "",

        stats:
            manifest.stats,

        ...(icon
            ? {
                icon:
                    `/packs/${packId}/${icon}`
            }
            : {}),

        manifest:
            `/packs/${packId}/manifest.json`
    };
}

/*
 * ============================================================
 * Main
 * ============================================================
 */

async function main() {
    console.log(
        "====================================="
    );

    console.log(
        " Minecraft / SkyBlock Pack Indexer"
    );

    console.log(
        "====================================="
    );

    console.log(
        `Pack-Verzeichnis: ${PACKS_DIR}`
    );

    if (!(await exists(PACKS_DIR))) {
        await fs.mkdir(
            PACKS_DIR,
            {
                recursive: true
            }
        );
    }

    const entries =
        await fs.readdir(
            PACKS_DIR,
            {
                withFileTypes: true
            }
        );

    const packs = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        if (
            entry.name.startsWith(".")
        ) {
            continue;
        }

        const result =
            await indexPack(
                entry
            );

        packs.push(result);
    }

    packs.sort(
        (a, b) =>
            a.name.localeCompare(
                b.name
            )
    );

    const catalog = {
        version: 2,

        generatedAt:
            new Date().toISOString(),

        packs
    };

    await fs.writeFile(
        CATALOG_FILE,
        JSON.stringify(
            catalog,
            null,
            2
        ),
        "utf8"
    );

    console.log("");
    console.log(
        "====================================="
    );

    console.log(
        `${packs.length} Packs indexiert`
    );

    console.log(
        `catalog.json: ${CATALOG_FILE}`
    );

    console.log(
        "====================================="
    );
}

main().catch(error => {
    console.error("");
    console.error(
        "Fehler beim Erstellen des Index:"
    );

    console.error(error);

    process.exit(1);
});