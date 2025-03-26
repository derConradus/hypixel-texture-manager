document.addEventListener("DOMContentLoaded", function () {
    const itemsGrid = document.getElementById("itemsGrid");
    const categoryTabs = document.getElementById("categoryTabs");
    const texturePreviewContainer = document.getElementById("texturePreviewContainer");

    let itemsData = [];
    let sorterConfig = {};

    // Funktion zum Laden der Sortier- und Kategoriedateien
    function loadSortingConfig() {
        const sorterURL = 'http://localhost:3000/data/sorter/sorter.json';  // Backend-URL für sorter.json
        fetch(sorterURL)
            .then(response => response.json())
            .then(data => {
                sorterConfig = data;

                const itemsURL = 'http://localhost:3000/data/items.json';  // Backend-URL für items.json
                fetch(itemsURL)
                    .then(response => response.json())
                    .then(items => {
                        itemsData = items;

                        // Sortiere Items zuerst nach Priorität und dann nach Name
                        sorterConfig.sorting.forEach(sortMethod => {
                            /*if (sortMethod.key === 'priority') {
                                itemsData.sort((a, b) => b.priority - a.priority);
                            }*/
                            if (sortMethod.key === 'name') {
                                itemsData.sort((a, b) => a.name.localeCompare(b.name));
                            }
                        });

                        // Dynamisch Kategorien als Reiter hinzufügen
                        const categories = sorterConfig.categories;
                        Object.keys(categories).forEach(category => {
                            const tab = document.createElement('button');
                            tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                            tab.addEventListener('click', () => showCategoryItems(category, categories[category]));
                            categoryTabs.appendChild(tab);
                        });

                        // Zeige die erste Kategorie standardmäßig
                        showCategoryItems(Object.keys(categories)[0], categories[Object.keys(categories)[0]]);
                    })
                    .catch(error => console.error("Fehler beim Laden der Item-Daten:", error));
            })
            .catch(error => console.error("Fehler beim Laden der Sortierkonfiguration:", error));
    }

    // Funktion zum Anzeigen von Items nach Kategorie
    function showCategoryItems(category, itemNames) {
        const filteredItems = itemsData.filter(item => itemNames.includes(item.name));

        itemsGrid.innerHTML = '';

        filteredItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');

            const itemImage = document.createElement('img');
            itemImage.src = `http://localhost:3000/resourcepacks/${category}/${item.name}.png`;  // Dynamisch Texturen vom Server holen
            itemImage.alt = `Textur für ${item.name}`;

            const itemName = document.createElement('p');
            itemName.textContent = item.name;

            itemDiv.appendChild(itemImage);
            itemDiv.appendChild(itemName);

            itemDiv.addEventListener('click', () => showTextures(item));

            itemsGrid.appendChild(itemDiv);
        });
    }

    // Funktion zum Anzeigen der Texturen eines Items
    function showTextures(item) {
        texturePreviewContainer.innerHTML = '';  // Leere vorherige Vorschau

        const textureUrl = `http://localhost:3000/resourcepacks/${item.category}/${item.name}.png`;  // URL der Textur

        const textureImage = document.createElement('img');
        textureImage.src = textureUrl;
        textureImage.alt = "Textur";

        texturePreviewContainer.appendChild(textureImage);
    }

    loadSortingConfig();
});
