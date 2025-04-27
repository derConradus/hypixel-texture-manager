document.addEventListener("DOMContentLoaded", function () {
    const itemsGrid = document.getElementById("itemsGrid");
    const categoryTabs = document.getElementById("categoryTabs");
    const texturePreviewContainer = document.getElementById("texturePreviewContainer");

    let itemsData = [];
    let sorterConfig = {};

    // at loading to get a list of all texture packs
    window.onload = function() {
        fetch('/resourcepackslist/')
          .then(response => response.json())
          .then(data => {
            const texturePackSelect = document.getElementById('packSelect'); // Die ID der Select-Box
      
            // list into select box
            data.forEach(pack => {
              const option = document.createElement('option');
              option.value = pack.id; 
              option.textContent = pack.name;
              texturePackSelect.appendChild(option);
            });
          })
          .catch(error => console.error('Fehler beim Laden der Texture Packs:', error));
      };

    // Function to load sorting and category files
    function loadSortingConfig() {
        const sorterURL = 'http://localhost:3000/data/sorter/sorter.json';  // Backend URL for sorter.json
        fetch(sorterURL)
            .then(response => response.json())
            .then(data => {
                sorterConfig = data;

                const itemsURL = 'http://localhost:3000/data/items.json';  // Backend URL for items.json
                fetch(itemsURL)
                    .then(response => response.json())
                    .then(items => {
                        itemsData = items;

                        // Sort items first by priority and then by name
                        sorterConfig.sorting.forEach(sortMethod => {
                            /*if (sortMethod.key === 'priority') {
                                itemsData.sort((a, b) => b.priority - a.priority);
                            }*/
                            if (sortMethod.key === 'name') {
                                itemsData.sort((a, b) => a.name.localeCompare(b.name));
                            }
                        });

                        // Dynamically add categories as tabs
                        const categories = sorterConfig.categories;
                        Object.keys(categories).forEach(category => {
                            const tab = document.createElement('button');
                            tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                            tab.addEventListener('click', () => showCategoryItems(category, categories[category]));
                            categoryTabs.appendChild(tab);
                        });

                        // Show the first category by default
                        showCategoryItems(Object.keys(categories)[0], categories[Object.keys(categories)[0]]);
                    })
                    .catch(error => console.error("Error loading item data:", error));
            })
            .catch(error => console.error("Error loading sorting configuration:", error));
    }

    // Function to display items by category
    function showCategoryItems(category, itemNames) {
        const filteredItems = itemsData.filter(item => itemNames.includes(item.name));

        itemsGrid.innerHTML = '';

        filteredItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');

            const itemImage = document.createElement('img');
            itemImage.src = `http://localhost:3000/resourcepacks/${category}/${item.name}.png`;  // Dynamically fetch textures from server
            itemImage.alt = `Texture for ${item.name}`;

            const itemName = document.createElement('p');
            itemName.textContent = item.name;

            itemDiv.appendChild(itemImage);
            itemDiv.appendChild(itemName);

            itemDiv.addEventListener('click', () => showTextures(item));

            itemsGrid.appendChild(itemDiv);
        });
    }

    // Function to display the textures of an item
    function showTextures(item) {
        texturePreviewContainer.innerHTML = '';  // Clear previous preview

        const textureUrl = `http://localhost:3000/resourcepacks/${item.category}/${item.name}.png`;  // URL of the texture

        const textureImage = document.createElement('img');
        textureImage.src = textureUrl;
        textureImage.alt = "Texture";

        texturePreviewContainer.appendChild(textureImage);
    }

    // Function to export data as JSON (Export the data for another time)
    function exportDataAsJson(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, 'texture_data.json');
    }

    // Function to export data as ZIP (Export the Texturepack)
    function exportDataAsZip(data) {
        const zip = new JSZip();

        // Add all textures as files in the ZIP
        data.forEach(item => {
            const textureUrl = `http://localhost:3000/resourcepacks/${item.category}/${item.name}.png`;
            fetch(textureUrl)
                .then(response => response.blob())
                .then(blob => {
                    zip.file(`${item.category}/${item.name}.png`, blob);
                });
        });

        // Once all textures are added, generate the ZIP and download it
        zip.generateAsync({ type: "blob" })
            .then(function(content) {
                saveAs(content, "texture_pack.zip");
            });
    }

    // Function to gather current data from the UI
    function gatherData() {
        let data = [];
        const categoryTabs = document.querySelectorAll('#categoryTabs .categoryTab');
        categoryTabs.forEach(tab => {
            const categoryName = tab.querySelector('h3').textContent;
            tab.querySelectorAll('.item').forEach(item => {
                const itemData = {
                    name: item.querySelector('p').textContent,
                    category: categoryName
                };
                data.push(itemData);
            });
        });
        return data;
    }

    // Event listener for the Export as Data button (Export the data for another time)
    document.getElementById('exportDataBtn').addEventListener('click', () => {
        const dataToExport = gatherData();  // Collect the data from the UI
        exportDataAsJson(dataToExport);  // Export as JSON
    });

    // Event listener for the Export as Texturepack button (Export the Texturepack)
    document.getElementById('exportTextureBtn').addEventListener('click', () => {
        const dataToExport = gatherData();  // Collect the data from the UI
        exportDataAsZip(dataToExport);  // Export as ZIP
    });

// Funktion to load the items and show them in the grid
function loadItemsGrid(items) {
    itemsGrid.innerHTML = '';  // empty grid

    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.classList.add('item');
        itemElement.setAttribute('data-id', item.id);

        // make a texture-image for each item
        const texture = document.createElement('img');
        texture.src = `data:image/png;base64,${item.skin.value}`;  // Base64-image
        texture.alt = item.name;
        texture.classList.add('item-texture');

        // create a label for each name of the items
        const name = document.createElement('span');
        name.innerText = item.name;
        name.classList.add('item-name');

        itemElement.appendChild(texture);
        itemElement.appendChild(name);

        // added event-listener, if click on an item
        itemElement.addEventListener('click', () => onItemClick(item));

        itemsGrid.appendChild(itemElement);
    });
}

loadItemsGrid(items.items); 

function onItemClick(item) {
    const texturePreviewContainer = document.getElementById('texturePreviewContainer');

    // show the pick texture a a priview
    const preview = document.createElement('img');
    preview.src = `data:image/png;base64,${item.skin.value}`;
    preview.alt = 'Texture Preview';
    preview.classList.add('texture-preview');

    texturePreviewContainer.innerHTML = '';  // empte the container
    texturePreviewContainer.appendChild(preview);

    // list of all availible texture showing
    const textureList = document.createElement('div');
    textureList.classList.add('texture-list');

    item.alternativeTextures?.forEach(textureData => {
        const textureItem = document.createElement('div');
        textureItem.classList.add('texture-item');

        const textureImage = document.createElement('img');
        textureImage.src = `data:image/png;base64,${textureData.value}`;
        textureImage.classList.add('texture-image');
        textureItem.appendChild(textureImage);

        textureItem.addEventListener('click', () => onTextureSelect(textureData));

        textureList.appendChild(textureItem);
    });

    texturePreviewContainer.appendChild(textureList);
}

function onTextureSelect(textureData) {
    // change preview picture, if a new texture is picked
    const texturePreview = document.querySelector('.texture-preview');
    texturePreview.src = `data:image/png;base64,${textureData.value}`;

    //console.log('Selected texture:', textureData);
}

// funktion to load from json files
function loadJson(url) {
    return fetch(url)
        .then(response => response.json())
        .then(data => data)
        .catch(error => console.error('Error loading JSON:', error));
}

loadJson('../backend/data/items.json').then(data => {
    loadItemsGrid(data.items);
});


    loadSortingConfig();
});
