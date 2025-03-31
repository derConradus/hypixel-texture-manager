const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;
const texturePackDir = path.join(__dirname, 'resourcepacks');


// static files from the 'public' directionary 
app.use(express.static(path.join(__dirname, '../public')));

// API-Endpoint for JSON-data
app.get('/data/items.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'items.json'));
});

// API to get the Sorters
app.get('/data/sorter/sorter.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'sorter', 'sorter.json'));
});

// Endpoint for Reource packs tetures
app.get('/resourcepacks/:pack/:texture', (req, res) => {
    const { pack, texture } = req.params;
    const texturePath = path.join(__dirname, 'resourcepacks', pack, texture);

    // controll, if texture exist
    fs.access(texturePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send('Texture not found');
        }
        res.sendFile(texturePath);
    });
});

// API give names from the texture packs back to the site
app.get('/resourcepackslist/', (req, res) => {
    fs.readdir(texturePackDir, (err, directories) => {
      if (err) {
        return res.status(500).json({ error: 'Error at the reading of the directionary' });
      }
  
      const texturePacks = [];
  
      // Jede "config.json" aus den Ordnern lesen
      // read each "config.json" from the directionary
      directories.forEach(directory => {
        const configPath = path.join(texturePackDir, directory, 'config.json');
  
        // controll if cofif.json exist
        if (fs.existsSync(configPath)) {
          const config = require(configPath);
          
          texturePacks.push({
            id: config.id,
            name: config.name
          });
        }
      });
  
      res.json(texturePacks);
    });
  });

// start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
