const tagOrder = ['RA Diagram', 'Fundamentals', 'Gaps & Alignment', 'Meter System', 'Flats & Exits', 'Circle Moves', 'Follow Moves', 'Beginner', 'Intermediate', 'Advanced', 'Elite', 'Community Moves'];

// Array to store local data
let localData = [];

// Function to fetch data from Firestore at page load
async function fetchInitialData() {
    const dictionaryContainer = document.getElementById('dictionary-container');

    // Reference to your Firestore collection
    const dictionaryCollection = db.collection('dict').doc('dictionary'); // Replace with your actual collection name and document ID

    try {
        // Get the 'dictionary' document from the collection
        const documentSnapshot = await dictionaryCollection.get();

        if (!documentSnapshot.exists) {
            console.log('No documents found.');
            return;
        }

        const data = documentSnapshot.data();

        // Convert the map to an array of entries
        localData = Object.entries(data);

        // Clear existing entries
        dictionaryContainer.innerHTML = '';

        // Sort and display all entries initially
        await loadLocalData();
    } catch (error) {
        console.error('Error fetching documents:', error);
    }
}

// Function to load local data with extended search functionality
async function loadLocalData(searchTerm, searchCategory) {
    const dictionaryContainer = document.getElementById('dictionary-container');

    // Clear existing entries
    dictionaryContainer.innerHTML = '';

    // Filter and sort documents based on the search category and term
    const filteredDocs = localData.filter(([entryId, entryData]) => {
        switch (searchCategory) {
            case 'dictName':
                return entryData.dictName.toLowerCase().includes(searchTerm.toLowerCase());
            case 'dictDef':
                return entryData.dictDef.toLowerCase().includes(searchTerm.toLowerCase());
            case 'dictTag':
                return entryData.dictTag.toLowerCase().includes(searchTerm.toLowerCase());
            case 'all':
                return (
                    entryData.dictName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entryData.dictTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    entryData.dictDef.toLowerCase().includes(searchTerm.toLowerCase())
                );
            default:
                return false;
        }
    });

    // Sort filtered documents by dictTag and dictIndex
    filteredDocs.sort((a, b) => {
        const tagComparison = tagOrder.indexOf(a[1].dictTag) - tagOrder.indexOf(b[1].dictTag);
        if (tagComparison !== 0) {
            return tagComparison;
        }
        return a[1].dictIndex - b[1].dictIndex;
    });

    // Display sorted documents
    filteredDocs.forEach(([entryId, data]) => {
        // Pass the entryId along with the data
        const entry = createDictionaryEntry({ ...data, entryId });
        dictionaryContainer.appendChild(entry);
    });
    return localData;
}



async function refreshSearch() {
    // Get values from the search box and dropdown
    const searchTerm = document.querySelector('.searchBar').value.trim();
    const searchCategory = document.querySelector('.searchCategory').value.trim();

    // Refresh the displayed entries based on the search
    await fetchInitialData();
    await loadLocalData(searchTerm, searchCategory);
}


window.onload = function () {

// Function to handle search input changes
    document.querySelector('.searchBar').addEventListener('input', function (event) {
        const searchTerm = event.target.value.trim();
        const searchCategory = document.querySelector('.searchCategory').value;
        loadLocalData(searchTerm, searchCategory);
    });

// Function to handle dropdown (select) changes
    document.querySelector('.searchCategory').addEventListener('change', function () {
        const searchTerm = document.querySelector('.searchBar').value.trim();
        const searchCategory = document.querySelector('.searchCategory').value;
        loadLocalData(searchTerm, searchCategory);
    });
// Initially load all entries
    refreshSearch();
}

// Function to toggle dropdown visibility
function toggleDropdown(iconElement) {
    const entry = iconElement.closest('.dictEntry');
    const image = entry.querySelector('.dictImg');

    // Toggle the visibility of the image
    if (image.style.display === 'none' || image.style.display === '') {
        image.style.display = 'block';
        iconElement.textContent = '▲'; // Change icon to up arrow
    } else {
        image.style.display = 'none';
        iconElement.textContent = '▼'; // Change icon to down arrow
    }
}

// Function to create a dictionary entry with dynamic links
function createDictionaryEntry(data, insertAfter = null, fromLink = false) {
    const entry = document.createElement('div');
    entry.classList.add('dictEntry');

    let docId;

    // if (data.entryId) {
    //     docId = data.entryId;
    // } else if (insertAfter) {
    //     docId = insertAfter;
    // }
    if (fromLink) {
        console.log(data);
    }
    docId = data.entryId;

    // Parse dictDef for references and create dynamic links
    const parsedDictDef = parseDictDef(data.dictDef, docId);
    // Check if it's on the admin page and add buttons if true
    const isAdminPage = document.getElementById('adminDictionaryContainer') !== null;

    entry.dataset.docId = data.entryId;
    entry.dataset.dictIndex = data.dictIndex;

    // Add the class "fromLink" if the entry is being created from a clicked link
    if (fromLink) {
        entry.classList.add('fromLink');
    }
    entry.setAttribute('data-doc-id', docId);
    entry.innerHTML = `
        <p class="dictTag">${data.dictTag}
        ${fromLink ? `<span class="closeButton buttonIcon" onclick="closeEntry(this)">×</span>` : ''}</p>
        
        <div class="dictText">
            ${isAdminPage ? createAdminButtons(data.entryId, data.dictIndex) : ''}
            <p class="dictName">${data.dictName}</p>
            <p class="dictSpacer">-</p>
            <p class="dictDef">${parsedDictDef}</p>
            ${data.dictImg ? '<div class="dropdownIcon  buttonIcon" onclick="toggleDropdown(this)">▼</div>' : ''}
        </div>
            ${data.dictImg ? `<img class="dictImg" src="${data.dictImg}">` : ''}    `;




    // Insert the entry after the specified position or append it to the end
    const dictionaryContainer = document.getElementById('dictionary-container');
    if (insertAfter) {
        const referenceEntry = document.querySelector(`[data-rand-id="${insertAfter}"]`);
        if (referenceEntry) {
            referenceEntry.insertAdjacentElement('afterend', entry);
        } else {
            console.warn(`Reference entry with ID ${insertAfter} not found. Appending to the end.`);
            dictionaryContainer.appendChild(entry);
        }
    } else {
        dictionaryContainer.appendChild(entry);
    }

    return entry;
}


function createAdminButtons(docId, dictIndex) {
    return `
        <p class="dictIndex">${dictIndex}</p>
        <div class="adminButtons">
            <span class="upButton buttonIcon" onclick="moveEntryUp('${docId}')">↑</span>
            <span class="downButton buttonIcon" onclick="moveEntryDown('${docId}')">↓</span>
            <span class="deleteButton buttonIcon" onclick="deleteEntry('${docId}')">×</span>
            <span class="editButton buttonIcon" onclick="openEditEntryForm('${docId}')">✎</span>
        </div>
    `;
}

// Function to close entry (used for the fromLink entries)
function closeEntry(closeButton) {
    // Find the closest dictionary entry container and remove it
    const entry = closeButton.closest('.dictEntry');
    if (entry) {
        entry.remove();
    } else {
        console.error('Entry container not found.');
    }
}

// Function to parse dictDef for references and create dynamic links
function parseDictDef(dictDef, docId) {
    const regex = /\{\{([^}]+?)\}\}(\(([^)]+?)\))?/g;
    return dictDef.replace(regex, (match, searchTerm, group2, displayText) => {
        const linkSearchTerm = searchTerm.trim();
        const linkText = (displayText || linkSearchTerm).trim();
        return `<span class="dictLink" onclick="handleDictLinkClick('${linkSearchTerm}', '${docId}', this)">${linkText}</span>`;
    });
}


// Function to handle click on dynamic links in dictDef
async function handleDictLinkClick(referencedDictName, docId, linkElement) {
    const searchTerm = referencedDictName.trim().toLowerCase();
    const searchInput = document.querySelector('.searchBar');
    const currentSearchTerm = searchInput.value.trim();
    const currentSearchCategory = document.querySelector('.searchCategory').value;



    // Perform a new search based on the current content of the search bar
    // await loadLocalData(currentSearchTerm, currentSearchCategory);

    try {
        const referencedEntry = localData.find(([entryId, entryData]) => entryData.dictName.toLowerCase() === searchTerm);

        if (referencedEntry) {
            // Create the referenced entry and append it to the container
            const [entryId, entryData] = referencedEntry;
            entryData.docId = docId;
            entryData.entryId = entryId;  // Ensure entryId is set from the referenced entry

            // Find any open 'fromLink' entry with the same docId
            const existingEntry = document.querySelector(`.dictEntry.fromLink[data-doc-id="${entryId}"]`);
            console.log("searching for duplicate entry " + entryId);

            if (existingEntry) {
                // If the entry is already open, close it first
                console.log("existing entry found, closing");
                const closeButton = existingEntry.querySelector('.closeButton');
                if (closeButton) {
                    console.log("found closeButton");
                    closeEntry(closeButton); // Close the existing open entry
                }
            }

            // Generate a new randId for the new entry
            const randId = generateRandId();

            // Select the parent div containing the clicked link
            const parentDiv = linkElement.closest('.dictEntry');
            if (parentDiv) {
                parentDiv.setAttribute('data-rand-id', randId); // Set the randId as an attribute on the parent div
            }

            createDictionaryEntry(entryData, randId, true);
        } else {
            console.log('Referenced entry not found.');
        }



    } catch (error) {
        console.error('Error handling dict link click:', error);
    }



}


//Back to top button and sticky search bar
document.addEventListener('DOMContentLoaded', function() {
    var backToTopBtn = document.getElementById("backToTopBtn");

    window.onscroll = function() {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            backToTopBtn.style.display = "block";
        } else {
            backToTopBtn.style.display = "none";
        }

        var searchContainer = document.getElementById('search-container');
        var header = document.querySelector('.header'); // Change this line
        var searchBar = document.getElementById('search-bar');

        var scrollPosition = window.scrollY;

        if (scrollPosition > header.offsetHeight) {
            searchContainer.classList.add('sticky');
        } else {
            searchContainer.classList.remove('sticky');
        }
    };

    backToTopBtn.onclick = function() {
        // For modern browsers
        document.body.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // For Safari
        document.documentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };


});

function generateRandId() {
    return Date.now() + '_' + Math.floor(Math.random() * 1000);
}