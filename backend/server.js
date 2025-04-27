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
    /*const { pack, texture } = req.params;
    const texturePath = path.join(__dirname, 'resourcepacks', pack, texture);

    // controll, if texture exist
    fs.access(texturePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send('Texture not found');
        }
        res.sendFile(texturePath);
    });*/

    /*const { pack, texture } = req.params;
    const resourcePackDir = path.join(__dirname, 'resourcepacks', pack);

    // Start the search in the root directory of the resource pack
    searchDirectoryForTexture(resourcePackDir, texture, (err, texturePath) => {
        if (err) {
            return res.status(404).send(err);  // Texture not found
        }

        // Send the texture file if found
        res.sendFile(texturePath);
    });*/

    const { pack, texture } = req.params;
    const resourcePackDir = path.join(__dirname, 'resourcepacks', pack);

    let responseSent = false;  // Flag to prevent multiple responses

    // Start the search in the root directory of the resource pack
    searchDirectoryForTexture(resourcePackDir, texture, (err, texturePath) => {
        if (responseSent) return;  // Prevent multiple responses

        if (err) {
            responseSent = true;  // Mark that the response has been sent
            return res.status(404).send(err);  // Texture not found or directory does not exist
        }

        responseSent = true;  // Mark that the response has been sent
        res.sendFile(texturePath);  // Send the texture file if found
    });
});

// Function to recursively search a directory for a file
const searchDirectoryForTexture = (directory, texture, callback) => {
  fs.readdir(directory, (err, files) => {
      if (err) {
          return callback(err);
      }

      let texturePath = null;

      // Check if texture file exists in this directory
      for (let file of files) {
          let filePath = path.join(directory, file);

          // If it's a directory, search inside it
          fs.stat(filePath, (err, stats) => {
              if (stats.isDirectory()) {
                  searchDirectoryForTexture(filePath, texture, callback);  // Recursively search
              } else if (file === texture + '.png') {
                  texturePath = filePath;  // Found the texture
                  return callback(null, texturePath);  // Return the found texture path
              }
          });
      }

      // If texture wasn't found, pass a 'not found' error
      if (!texturePath) {
          return callback('Texture not found');
      }
  });
};

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
