# Custom Category Files
Each custom category file (e.g., swords.json, armor.json, tools.json) contains the specific filtering and sorting logic for that category.</br>

## Explanation of the Fields</br>
1. default</br>
  -  this defines the default sorting struktur when no spezific category is picked</br>

2. Each category has the following fields:</br>
- categoryName: The name of the custom category.</br>
- file: The path to the JSON file that contains the specific sorting logic for this category.</br>
- filter: Filters the items that belong to this category.</br>
    - type: (optional) The type of item to filter by.</br>
    - exclude: (optional) A list of items to exclude from this category.</br>
    - includeItems: (optional) A list of specific items to include in the category.</br>
    - excludeItems: (optional) A list of specific items to exclude from the category.</br>
- sortBy: The order in which the items are sorted. You can specify multiple fields to sort by, such as "priority" and "name".</br>

## Two Ways to Filter Items
### Filter by Attributes:
You can filter items based on their attributes like type, category, or name.

Example: All swords except "Legendary Sword" are grouped together.


### Filter by List of Specific Items:
You can specify a list of specific items to include or exclude from the category.


## How to Create a Custom Sorter
Creating a custom sorter involves the following steps:
Create a new JSON file in the customSorters folder. You can name the file based on the category or type of items it will contain (e.g., swords.json, tools.json).

Define the Sorting Logic:
Each file should contain a sorting logic in the format below. You can specify the categoryName, the filter conditions, and how you want to sortBy.

Example of Creating a Custom Sorter (swords.json):
{
  "categoryName": "All Swords (except one)",
  "filter": {
    "type": "sword",
    "exclude": ["Legendary Sword"]
  },
  "sortBy": ["priority", "name"]
}

categoryName: The name of the category (e.g., "All Swords (except one)").

filter: A filter condition to include or exclude items. In this case, we're excluding the "Legendary Sword" and including all other items of type "sword".

sortBy: Defines how the items should be sorted. In this case, it's first sorted by priority and then by name.

Link the Custom Sorter in sorter.json: After creating the custom sorter file, you need to reference it in the sorter.json file. You can link it as shown below:

{
  "categoryName": "Swords",
  "file": "customSorters/swords.json"
}

This will load the swords.json file from the customSorters folder and apply the sorting logic contained in that file.
Test the Sorter: Once the custom sorter is created and linked, test it by running the application to see if the items are sorted correctly.

### Adding More Categories
To add more categories, simply create a new file inside the customSorters folder and reference it in the sorter.json file. Be sure to set the categoryName, filter, and sortBy fields properly.
Example of Adding a New Category:
{
  "categoryName": "Epic Swords",
  "filter": {
    "type": "sword",
    "exclude": ["Legendary Sword"]
  },
  "sortBy": ["priority", "name"]
}

This example adds a new category called "Epic Swords" that includes all swords except for the "Legendary Sword". The swords are sorted by Priority and then Name.