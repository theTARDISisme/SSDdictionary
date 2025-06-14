const tagOrder = ['The Arena', 'Fundamentals', 'Alignment', 'Meter System', 'Flats & Exits', 'Circle Moves', 'Follow Moves', 'Beginner', 'Intermediate', 'Advanced', 'Elite'];

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

        // Check if the error is related to quota limits being exceeded
        if (error.code === 'resource-exhausted') {
            // Update the UI to show a message that the service is down for the day
            dictionaryContainer.innerHTML = `
                <p class="error-message">
                    Currently unavailable. Daily limit has been reached. Please try again later.
                </p>
            `;
        } else {
            // Handle other errors
            dictionaryContainer.innerHTML = `
                <p class="error-message">
                    An error occurred while loading the data. Please try again later.
                </p>
            `;
        }
    }
}

// Function to load local data with extended search functionality
async function loadLocalData(searchTerm = '', searchCategory = 'all') {
    const dictionaryContainer = document.getElementById('dictionary-container');
    dictionaryContainer.innerHTML = '';

    // Get selected categories
    const selectedTags = Array.from(document.querySelectorAll('.categoryCheckbox:checked'))
        .map(cb => cb.value);

    const filteredDocs = localData.filter(([entryId, entryData]) => {
        // First: tag filter (skip if tags selected and current one is not included)
        if (selectedTags.length > 0 && !selectedTags.includes(entryData.dictTag)) {
            return false;
        }

        // Then: text filter
        const term = searchTerm.toLowerCase();
        switch (searchCategory) {
            case 'dictName':
                return entryData.dictName.toLowerCase().includes(term);
            case 'dictDef':
                return entryData.dictDef.toLowerCase().includes(term);
            case 'dictTag':
                return entryData.dictTag.toLowerCase().includes(term);
            case 'all':
            default:
                return (
                    entryData.dictName.toLowerCase().includes(term) ||
                    entryData.dictDef.toLowerCase().includes(term)
                );
        }
    });

    // Sort and display like before
    filteredDocs.sort((a, b) => {
        const tagComparison = tagOrder.indexOf(a[1].dictTag) - tagOrder.indexOf(b[1].dictTag);
        return tagComparison !== 0 ? tagComparison : a[1].dictIndex - b[1].dictIndex;
    });

    filteredDocs.forEach(([entryId, data]) => {
        const entry = createDictionaryEntry({ ...data, entryId });
        dictionaryContainer.appendChild(entry);
    });

    return localData;
}

function populateCategoryDropdown() {
    const dropdownContent = document.getElementById('categoryDropdownContent');
    dropdownContent.innerHTML = '<b>Filter Categories</b>'; // Clear in case it's being re-initialized

    tagOrder.forEach(tag => {
        const label = document.createElement('label');
        label.classList.add('block');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('categoryCheckbox');
        checkbox.value = tag;

        // Add change listener for live filtering
        checkbox.addEventListener('change', () => {
            const searchTerm = document.querySelector('.searchBar').value.trim();
            const searchCategory = document.querySelector('.searchCategory').value;
            loadLocalData(searchTerm, searchCategory);
        });

        label.appendChild(checkbox);
        label.append(` ${tag}`);
        dropdownContent.appendChild(label);
    });
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
    populateCategoryDropdown();


    document.querySelector('.categoryDropdownToggle').addEventListener('click', function () {
        this.classList.toggle('active');
    });

    document.querySelectorAll('.categoryCheckbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const searchTerm = document.querySelector('.searchBar').value.trim();
            const searchCategory = document.querySelector('.searchCategory').value;
            loadLocalData(searchTerm, searchCategory);
        });
    });

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

    const toggleButton = document.getElementById('categoryFilterButton');
    const dropdown = document.getElementById('categoryDropdownContent');
    const dropdownWrapper = document.getElementById('categoryFilter');

    document.addEventListener('click', function (e) {
        console.log('Clicked:', e.target); // Debug
        if (!dropdownWrapper.contains(e.target)) {
            toggleButton.classList.remove('active');
        }
    });


// Initially load all entries
    refreshSearch();
}

// Function to set media width dynamically
async function setMediaDimensions(mediaPlaceholder) {
    // Wait for the media to load before accessing dimensions
    const imgElement = mediaPlaceholder.querySelector('.dictImg');
    const videoElement = mediaPlaceholder.querySelector('.dictVideo');

    // If it's an image, use onload event; if it's a video, use loadedmetadata event
    if (imgElement) {
        imgElement.onload = () => {
            const aspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;
            mediaPlaceholder.style.width = `${375 * aspectRatio}px`; // 375px is the max height
        };
    } else if (videoElement) {
        videoElement.onloadedmetadata = () => {
            const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
            mediaPlaceholder.style.width = `${375 * aspectRatio}px`; // 375px is the max height
        };
    }
}

// Function to toggle dropdown visibility
async function toggleDropdown(iconElement) {
    const entry = iconElement.closest('.dictEntry');
    const media = entry.querySelector('.dictMedia');
    const mediaPlaceholder = media.querySelector('.mediaPlaceholder:first-child');
    const mediaPlaceholder2 = media.querySelector('.mediaPlaceholder:last-child');

    // Check if media is loaded by looking at a data attribute
    if (!media.dataset.loaded) {
        const dictImg = mediaPlaceholder.getAttribute('data-dict-img');
        const dictImg2 = mediaPlaceholder2.getAttribute('data-dict-img2');

        // Load the first image if available
        if (dictImg) {
            const mediaElement = await createMediaElement(dictImg);
            mediaPlaceholder.innerHTML = mediaElement;
            await setMediaDimensions(mediaPlaceholder);
        }

        // Load the second image if available
        if (dictImg2) {
            const mediaElement = await createMediaElement(dictImg2);
            mediaPlaceholder2.innerHTML = mediaElement;

            await setMediaDimensions(mediaPlaceholder2);

        }

        // Set the data attribute to indicate that the media has been loaded
        media.dataset.loaded = 'true';


    }

    // Toggle the visibility of the image
    if (media.style.display === 'none' || media.style.display === '') {
        media.style.display = 'flex';
        iconElement.innerHTML = '<span title="Collapse Media">▲</span>'; // Change icon to up arrow
    } else {
        media.style.display = 'none';
        iconElement.innerHTML = '<span title="Expand Media">▼</span>'; // Change icon to down arrow
    }
}

async function fetchContentType(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type');

        if (contentType.startsWith('image/')) {
            return 'image';
        } else if (contentType.startsWith('video/')) {
            return 'video';
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching content type:', error);
        return null;
    }
}

async function createMediaElement(url) {
    const type = await fetchContentType(url);
    if (type === 'image') {
        return `<img class="dictImg" src="${url}" alt="Image">`;
    } else if (type === 'video') {
        return `<video class="dictVideo" autoplay loop muted playsinline>
                    <source src="${url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>`;
    } else {
        return ''; // Return empty if the content type is unknown
    }
}

// Function to create a dictionary entry with dynamic links
function createDictionaryEntry(data, insertAfter = null, fromLink = false) {
    const entry = document.createElement('div');
    entry.classList.add('dictEntry');

    let docId;

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

    /// Initialize mediaHtml and mediaHtml2 with placeholders and lazy load attributes
    let mediaHtml = data.dictImg ? `<div class="mediaPlaceholder" data-dict-img="${data.dictImg}">Loading image...</div>` : '';
    let mediaHtml2 = data.dictImg2 ? `<div class="mediaPlaceholder" data-dict-img2="${data.dictImg2}">Loading image...</div>` : '';


    entry.innerHTML = `
        
        
        <div class="dictText">
            ${isAdminPage ? createAdminButtons(data.entryId, data.dictIndex) : ''}
            <p class="dictName">${data.dictName}</p>
            <p class="dictSpacer">-</p>
            <p class="dictDef">${parsedDictDef}</p>
            <p class="dictTag">${data.dictTag}
        ${fromLink ? `<span class="closeEntryButton buttonIcon" onclick="closeEntry(this)">×</span>` : ''}</p>
            ${data.dictImg || data.dictImg2 ? '<div class="dropdownIcon  buttonIcon" onclick="toggleDropdown(this)"><i title="Load Media" class="fa-solid fa-photo-film"></i></div>' : ''}
        </div>
        <div class="dictMedia">
            ${mediaHtml}
            ${mediaHtml2}    
        </div>
    `;

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
function closeEntry(closeEntryButton) {
    // Find the closest dictionary entry container and remove it
    const entry = closeEntryButton.closest('.dictEntry');
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

            if (existingEntry) {
                // If the entry is already open, close it first
                const closeEntryButton = existingEntry.querySelector('.closeEntryButton');
                if (closeEntryButton) {
                    closeEntry(closeEntryButton); // Close the existing open entry
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