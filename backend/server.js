const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Statische Dateien aus dem 'public' Ordner bereitstellen
app.use(express.static(path.join(__dirname, '../public')));

// API-Endpunkte für JSON-Daten
app.get('/data/items.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'items.json'));
});

app.get('/data/sorter/sorter.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'sorter', 'sorter.json'));
});

// Endpunkt für Resource Packs (Texturen)
app.get('/resourcepacks/:pack/:texture', (req, res) => {
    const { pack, texture } = req.params;
    const texturePath = path.join(__dirname, 'resourcepacks', pack, texture);

    // Überprüfe, ob die Textur existiert
    fs.access(texturePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send('Texture not found');
        }
        res.sendFile(texturePath);
    });
});

// Server starten
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
