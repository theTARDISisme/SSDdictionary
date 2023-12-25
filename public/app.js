const db = firebase.firestore();

const tagOrder = ['RA Diagram', 'Fundamentals', 'Gaps & Alignment', 'Meter System', 'Flats & Exits', 'Circle Moves', 'Follow Moves', 'Beginner', 'Intermediate', 'Advanced', 'Elite', 'Community Moves'];

// Function to fetch data from Firestore with extended search functionality
async function fetchData(searchTerm, searchCategory) {
    const dictionaryContainer = document.getElementById('dictionary-container');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Reference to your Firestore collection
    const dictionaryCollection = db.collection('dictionary'); // Replace with your actual collection name

    try {
        // Get all documents from the collection
        const querySnapshot = await dictionaryCollection.get();

        dictionaryContainer.innerHTML = ''; // Clear existing entries

        if (querySnapshot.empty) {
            console.log('No documents found.');
            return;
        }

        const filteredDocs = [];
        const searchTermLower = searchTerm.toLowerCase();

        // Filter and sort documents based on the search category and term
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            switch (searchCategory) {
                case 'dictName':
                    if (data.dictName && data.dictName.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push({...data, docId: doc.id});
                    }
                    break;
                case 'dictDef':
                    if (data.dictDef && data.dictDef.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push({...data, docId: doc.id});
                    }
                    break;
                case 'dictTag':
                    if (data.dictTag && data.dictTag.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push({...data, docId: doc.id});
                    }
                    break;
                case 'all':
                    if ((data.dictName && data.dictName.toLowerCase().includes(searchTermLower)) || (data.dictTag && data.dictTag.toLowerCase().includes(searchTermLower)) || (data.dictDef && data.dictDef.toLowerCase().includes(searchTermLower))) {
                        filteredDocs.push({...data, docId: doc.id});
                    }
                    break;
                default:
                    break;
            }
        });

        // Sort filtered documents by dictTag and dictIndex
        filteredDocs.sort((a, b) => {
            const tagComparison = tagOrder.indexOf(a.dictTag) - tagOrder.indexOf(b.dictTag);
            if (tagComparison !== 0) {
                return tagComparison;
            }
            return a.dictIndex - b.dictIndex;
        });

        // Display sorted documents
        filteredDocs.forEach((data) => {
            const entry = createDictionaryEntry(data);
            dictionaryContainer.appendChild(entry);
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
    }
}

async function refreshSearch() {
    // Get values from the search box and dropdown
    const searchTerm = document.querySelector('.searchBar').value.trim();
    const searchCategory = document.querySelector('.searchCategory').value.trim();

    // Refresh the displayed entries based on the search
    fetchData(searchTerm, searchCategory);
}


window.onload = function () {

// Function to handle search input changes
    document.querySelector('.searchBar').addEventListener('input', function (event) {
        const searchTerm = event.target.value.trim();
        const searchCategory = document.querySelector('.searchCategory').value;
        fetchData(searchTerm, searchCategory);
    });

// Function to handle dropdown (select) changes
    document.querySelector('.searchCategory').addEventListener('change', function () {
        const searchTerm = document.querySelector('.searchBar').value.trim();
        const searchCategory = document.querySelector('.searchCategory').value;
        fetchData(searchTerm, searchCategory);
    });
// Initially load all entries
    fetchData('', 'all');


}

// Function to toggle visibility of the image
function toggleImg(clickedElement) {
    const entry = clickedElement;
    const image = entry.querySelector('.dictImg');

    // Toggle the visibility of the image
    if (image.style.display === 'none' || image.style.display === '') {
        image.style.display = 'block';
    } else {
        image.style.display = 'none';
    }
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

    if (data.docId) {
        docId = data.docId;
    } else if (insertAfter) {
        docId = insertAfter;
    }

    // Parse dictDef for references and create dynamic links
    const parsedDictDef = parseDictDef(data.dictDef, docId);

    // Check if it's on the admin page and add buttons if true
    const isAdminPage = document.getElementById('adminDictionaryContainer') !== null;

    entry.dataset.docId = docId;
    entry.dataset.dictIndex = data.dictIndex;

    // Add the class "fromLink" if the entry is being created from a clicked link
    if (fromLink) {
        entry.classList.add('fromLink');
    }

    entry.innerHTML = `
        <p class="dictTag">${data.dictTag}</p>
        <div class="dictText">
            ${isAdminPage ? createAdminButtons(data.docId, data.dictIndex) : ''}
            <p class="dictName">${data.dictName}</p>
            <p class="dictSpacer">-</p>
            <p class="dictDef">${parsedDictDef}</p>
            ${data.dictImg ? '<div class="dropdownIcon  buttonIcon" onclick="toggleDropdown(this)">▼</div>' : ''}
        </div>
            ${data.dictImg ? `<img class="dictImg" src="${data.dictImg}">` : ''}    `;

    // Insert the entry after the specified position or append it to the end
    const dictionaryContainer = document.getElementById('dictionary-container');
    if (insertAfter) {
        const referenceEntry = document.querySelector(`[data-doc-id="${insertAfter}"]`);
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


// Function to parse dictDef for references and create dynamic links
function parseDictDef(dictDef, docId) {
    const regex = /\{\{([^}]+?)\}\}(\(([^)]+?)\))?/g;
    return dictDef.replace(regex, (match, searchTerm, group2, displayText) => {
        const linkSearchTerm = searchTerm.trim();
        const linkText = (displayText || linkSearchTerm).trim();
        return `<span class="dictLink" onclick="handleDictLinkClick('${linkSearchTerm}', '${docId}')">${linkText}</span>`;
    });
}


// Function to handle click on dynamic links in dictDef
async function handleDictLinkClick(referencedDictName, docId) {
    const searchTerm = referencedDictName.trim().toLowerCase();
    const searchCategory = 'dictName';

    const searchInput = document.querySelector('.searchBar');
    const currentSearchTerm = searchInput.value.trim();
    const currentSearchCategory = document.querySelector('.searchCategory').value;

    console.log('Current search term:', currentSearchTerm);
    console.log('Current search category:', currentSearchCategory);

    // Perform a new search based on the current content of the search bar
    await fetchData(currentSearchTerm, currentSearchCategory);

    try {
        // Get all documents from the collection
        const querySnapshot = await db.collection('dictionary').get();

        if (querySnapshot.empty) {
            console.log('No documents found.');
            return;
        }

        const referencedEntry = Array.from(querySnapshot.docs).find((doc) => doc.data().dictName.toLowerCase() === searchTerm);

        if (referencedEntry) {
            console.log('Referenced entry found:', referencedEntry.data());

            // Create the referenced entry and append it to the container
            const referencedData = referencedEntry.data();
            referencedEntry.docId = docId;

            createDictionaryEntry(referencedData, docId, true);

        } else {
            console.log('Referenced entry not found.');
        }
    } catch (error) {
        console.error('Error fetching documents:', error);
    }
}