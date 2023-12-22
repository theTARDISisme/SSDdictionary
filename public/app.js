// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAvsJFPYeoKoUYvryhpp-saOUGODQOzMeI",
    authDomain: "star-stable-dressage.firebaseapp.com",
    projectId: "star-stable-dressage",
    storageBucket: "star-stable-dressage.appspot.com",
    messagingSenderId: "170202438317",
    appId: "1:170202438317:web:580c18df86f56f84d20424",
    measurementId: "G-FTHYGB3Q1M"
};

// Initialize Firebase
console.log(firebase);
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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

        // Filter documents based on the search category and term
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            switch (searchCategory) {
                case 'dictName':
                    if (data.dictName && data.dictName.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push(data);
                    }
                    break;
                case 'dictDef':
                    if (data.dictDef && data.dictDef.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push(data);
                    }
                    break;
                case 'dictTag':
                    if (data.dictTag && data.dictTag.toLowerCase().includes(searchTermLower)) {
                        filteredDocs.push(data);
                    }
                    break;
                case 'all':
                    if (
                        (data.dictName && data.dictName.toLowerCase().includes(searchTermLower)) ||
                        (data.dictTag && data.dictTag.toLowerCase().includes(searchTermLower)) ||
                        (data.dictDef && data.dictDef.toLowerCase().includes(searchTermLower))
                    ) {
                        filteredDocs.push(data);
                    }
                    break;
                default:
                    break;
            }
        });

        // Display filtered documents
        filteredDocs.forEach((data) => {
            const entry = createDictionaryEntry(data);
            dictionaryContainer.appendChild(entry);
        });

        // Show the container and hide the loading indicator after data is loaded

    } catch (error) {
        console.error('Error fetching documents:', error);
    }
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
function createDictionaryEntry(data) {
    const entry = document.createElement('div');
    entry.classList.add('dictEntry');

    // Parse dictDef for references and create dynamic links
    const parsedDictDef = parseDictDef(data.dictDef);

    entry.innerHTML = `
        <p class="dictTag">${data.dictTag}</p>
        <div class="dictText">
            <p class="dictName">${data.dictName}</p>
            <p class="dictSpacer">-</p>
            <p class="dictDef">${parsedDictDef}</p>
            ${data.dictImg ? '<div class="dropdownIcon" onclick="toggleDropdown(this)">▼</div>' : ''}
        </div>
        <img class="dictImg" src="${data.dictImg}">
    `;

    return entry;
}


// Function to parse dictDef for references and create dynamic links
function parseDictDef(dictDef) {
    const regex = /\{\{([^}]+)\}\}/g;
    return dictDef.replace(regex, (match, dictName) => {
        return `<span class="dictLink" onclick="handleDictLinkClick('${dictName}')">${dictName}</span>`;
    });
}

// Function to handle click on dynamic links in dictDef
async function handleDictLinkClick(referencedDictName) {
    const searchTerm = referencedDictName.trim().toLowerCase();
    const searchCategory = 'dictName';

    const searchInput = document.querySelector('.searchBar');
    const currentSearchTerm = searchInput.value.trim();
    const currentSearchCategory = document.querySelector('.searchCategory').value;

    // Perform a new search based on the current content of the search bar
    await fetchData(currentSearchTerm, currentSearchCategory);

    try {
        // Get all documents from the collection
        const querySnapshot = await db.collection('dictionary').get();

        if (querySnapshot.empty) {
            console.log('No documents found.');
            return;
        }

        const referencedEntry = Array.from(querySnapshot.docs).find(
            (doc) => doc.data().dictName.toLowerCase() === searchTerm
        );

        if (referencedEntry) {
            // Create the referenced entry and append it to the container
            const referencedData = referencedEntry.data();
            const referencedEntryElement = createDictionaryEntry(referencedData);
            document.getElementById('dictionary-container').appendChild(referencedEntryElement);

            // Scroll to the newly displayed entry
            referencedEntryElement.scrollIntoView({behavior: 'smooth', block: 'start'});
        } else {
            console.log('Referenced entry not found.');
        }
    } catch (error) {
        console.error('Error fetching documents:', error);
    }
}