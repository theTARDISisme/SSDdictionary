//Check if the user is authenticated
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user);

        // You can load the content of your admin.html page here
    } else {
        // User is signed out
        console.log('User is signed out');
        // Redirect to the login page if not authenticated
        window.location.href = '/login';
    }
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB size limit for media uploads


// Function to move an entry up in Firestore
async function moveEntryUp(entryId) {
    try {
        const dictionaryCollection = db.collection('dict').doc('dictionary'); // Update with your actual collection name and document ID

        // Get the current entry's data
        const documentSnapshot = await dictionaryCollection.get();
        const dictionaryData = documentSnapshot.data();
        const currentEntryData = dictionaryData[entryId];
        const currentEntryIndex = currentEntryData.dictIndex;
        const currentEntryTag = currentEntryData.dictTag;

        if (currentEntryIndex === 0) {
            // Entry is already at the top, no need to move up
            console.log('Entry is already at the top.');
            return;
        }

        // Find the lower entry within the same category
        const entriesInCategory = Object.entries(dictionaryData || {})
            .filter(([_, entry]) => entry.dictTag === currentEntryTag);

        const lowerEntry = entriesInCategory.find(([_, entry]) => entry.dictIndex === currentEntryIndex - 1);

        if (lowerEntry) {
            // Swap the indices of the current entry and the lower entry
            const lowerEntryId = lowerEntry[0];

            const updates = {
                [`${entryId}.dictIndex`]: currentEntryIndex - 1,
                [`${lowerEntryId}.dictIndex`]: currentEntryIndex,
            };

            await dictionaryCollection.update(updates);
        }

        // Refresh the displayed entries after moving
        refreshSearch();

    } catch (error) {
        console.error('Error moving entry up:', error);
    }
}




// Function to move an entry down in Firestore
async function moveEntryDown(entryId) {
    try {
        const dictionaryCollection = db.collection('dict').doc('dictionary'); // Update with your actual collection name and document ID

        // Get the current entry's data
        const documentSnapshot = await dictionaryCollection.get();
        const dictionaryData = documentSnapshot.data();
        const currentEntryData = dictionaryData[entryId];
        const currentEntryIndex = currentEntryData.dictIndex;
        const currentEntryTag = currentEntryData.dictTag;

        // Find the higher entry within the same category
        const entriesInCategory = Object.entries(dictionaryData || {})
            .filter(([_, entry]) => entry.dictTag === currentEntryTag);

        const higherEntry = entriesInCategory.find(([_, entry]) => entry.dictIndex === currentEntryIndex + 1);

        if (higherEntry) {
            // Swap the indices of the current entry and the higher entry
            const higherEntryId = higherEntry[0];

            const updates = {
                [`${entryId}.dictIndex`]: currentEntryIndex + 1,
                [`${higherEntryId}.dictIndex`]: currentEntryIndex,
            };

            await dictionaryCollection.update(updates);
        }

        // Refresh the displayed entries after moving
        refreshSearch();

    } catch (error) {
        console.error('Error moving entry down:', error);
    }
}


// Function to dynamically generate the entry form
function generateNewEntryForm() {
    const newEntryFormCont = document.createElement('div');

    newEntryFormCont.id = 'newEntryFormCont';
    newEntryFormCont.classList.add('entryForm');

    newEntryFormCont.innerHTML = `
        <span class="closeButton buttonIcon" onClick="closeEntryForm()">×</span>
        <form id="newEntryForm" onsubmit="addEntry(); return false;">
            <label for="inputDictName">Name: </label>
            <input type="text" id="inputDictName" required>
            <label for="inputDictDef">Definition: </label>
            <textarea id="inputDictDef" required></textarea>
            <span class="entryFormNotice">To embed links to another entry, use {{Entry Name}} or {{Display Text}}(Entry Name)</span>
            <label for="inputDictTag">Category: </label>
            <select id="inputDictTag" required>
                <option value="" disabled selected hidden>Category</option>-->
                <!-- Options dynamically generated from your tagOrder array -->
            </select>
            <label for="inputDictImgFile">Upload Image/Video (optional): </label>
            <input type="file" id="inputDictImgFile" accept="image/*,video/*">
            
            <label for="inputDictImgFile2">Upload Second Image/Video (optional): </label>
            <input type="file" id="inputDictImgFile2" accept="image/*,video/*">
            <button class="button" type="submit">Add Entry</button>
        </form>
    `;

    // Populate the select dropdown with tag options
    const tagDropdown = newEntryFormCont.querySelector('#inputDictTag');
    tagOrder.forEach((tag) => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagDropdown.appendChild(option);
    });

    document.body.appendChild(newEntryFormCont);
}

// Function to open the entry form menu
function openNewEntryForm() {
    // Generate the form if not already present
    if (!document.querySelector('.entryForm')) {
        generateNewEntryForm();
    } else if (document.getElementById('editEntryFormCont')) {
        closeEntryForm();
        generateNewEntryForm();
    }
}

// Function to close and reset the entry form menu
function closeEntryForm() {
    const entryForm = document.querySelector('.entryForm');

    // Remove the form from the DOM to reset it
    entryForm.parentNode.removeChild(entryForm);
}

// Function to upload media from form
async function uploadMedia(inputDictImgFile, inputDictName) {
    // Check file size before upload
    if (inputDictImgFile.size > MAX_FILE_SIZE) {
        alert("File is too large. Please select a file smaller than 5MB.");
    } else {
        const storageRef = firebase.storage().ref();

        // Get the original file extension (e.g., .jpg, .png)
        const originalExtension = inputDictImgFile.name.split('.').pop();

        // Generate a unique file name using Firestore ID and original extension
        const uniqueFileName = `${generateFirestoreId(inputDictName)}.${originalExtension}`;
        const mediaRef = storageRef.child(`media/${uniqueFileName}`);

        // Upload the file to Firebase Storage
        const snapshot = await mediaRef.put(inputDictImgFile);
        // Get the download URL
        return await snapshot.ref.getDownloadURL();
    }
}

// Function to create a new entry in Firestore
async function addEntry() {
    const inputDictName = document.getElementById('inputDictName').value.trim();
    const inputDictDef = document.getElementById('inputDictDef').value.trim();
    const inputDictTag = document.getElementById('inputDictTag').value.trim();
    const inputDictImgFile = document.getElementById('inputDictImgFile').files[0];
    const inputDictImgFile2 = document.getElementById('inputDictImgFile2').files[0];


    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dict').doc('dictionary'); // Update with your actual collection name and document ID
    let mediaUrl
    let mediaUrl2
    try {
        // Generate a unique entryId
        const entryId = generateFirestoreId(inputDictName);

        if (inputDictImgFile){
            mediaUrl = await uploadMedia(inputDictImgFile, inputDictName);
        }
        if (inputDictImgFile2) {
            mediaUrl2 = await uploadMedia(inputDictImgFile2, inputDictName);
        }

        // Get the current data from Firestore
        const dictionaryData = (await dictionaryCollection.get()).data();

        // Query Firestore to find the max dictIndex for the current category (dictTag)
        const entriesInCategory = Object.entries(dictionaryData || {})
            .filter(([_, entry]) => entry.dictTag === inputDictTag);

        let newIndex = 0;
        if (entriesInCategory.length > 0) {
            // If there are existing entries in the category, set newIndex to the next available index
            newIndex = Math.max(...entriesInCategory.map(([_, entry]) => entry.dictIndex)) + 1;
        }

        // Create a new entry in Firestore with the calculated dictIndex
        await dictionaryCollection.update({
            [entryId]: {
                dictName: inputDictName,
                dictDef: inputDictDef,
                dictTag: inputDictTag,
                dictImg: mediaUrl,
                dictImg2: mediaUrl2,
                dictIndex: newIndex
            }
        });

        // Close the entry form
        closeEntryForm();

        // Refresh the displayed entries after adding
        refreshSearch();
    } catch (error) {
        console.error('Error adding entry to Firestore:', error);
    }
}




// Function to generate a valid Firestore document ID from inputDictName
function generateFirestoreId(inputDictName) {
    // Convert to lowercase and replace invalid characters with a hyphen
    const baseId = inputDictName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Generate a random string of 5 characters
    const randomString = Math.random().toString(36).substring(2, 7);

    // Combine the baseId with the random string
    return `${baseId}-${randomString}`;
}

// Function to delete an entry from Firestore
async function deleteEntry(entryId) {
    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dict').doc('dictionary'); // Update with your actual collection name and document ID

    try {
        // Delete the entry with the specified ID
        await dictionaryCollection.update({
            [entryId]: firebase.firestore.FieldValue.delete(),
        });

        // Optionally, you can update the UI to remove the deleted entry
        const entryElement = document.getElementById(entryId);
        if (entryElement) {
            entryElement.remove();
        }
        // Refresh the displayed entries after deleting
        refreshSearch();
    } catch (error) {
        console.error('Error deleting entry from Firestore:', error);
    }
}


// Function to generate the edit entry form dynamically
function generateEditEntryForm(entryId) {
    const editEntryFormCont = document.createElement('div');
    editEntryFormCont.id = 'editEntryFormCont';
    editEntryFormCont.classList.add('entryForm');

    editEntryFormCont.innerHTML = `
        <span class="closeButton buttonIcon" onClick="closeEntryForm()">×</span>
        <form id="editEntryForm" onsubmit="updateEntry('${entryId}'); return false;">
            <label for="inputEditDictName">Name: </label>
            <input type="text" id="inputEditDictName" required>
            <label for="inputEditDictDef">Definition: </label>
            <textarea id="inputEditDictDef" required></textarea>
            <span class="entryFormNotice">To embed links to another entry, use {{Entry Name}} or {{Display Text}}(Entry Name)</span>
            <label for="inputEditDictTag">Category: </label>
            <select id="inputEditDictTag" required>
                <option value="" disabled selected hidden>Category</option>-->
                <!-- Options dynamically generated from your tagOrder array -->
            </select>
            <label for="inputEditDictImgUrl">Current Image/Video URL: </label>
            <input type="text" id="inputEditDictImgUrl">
            <label for="inputEditDictImgFile">Upload New Image/Video: </label>
            <input type="file" id="inputEditDictImgFile" accept="image/*,video/*">
            <label for="inputEditDictImgUrl2">Current Second Image/Video URL: </label>
            <input type="text" id="inputEditDictImgUrl2">
            <label for="inputEditDictImgFile2">Upload New Second Image/Video: </label>
            <input type="file" id="inputEditDictImgFile2" accept="image/*,video/*">
            <button class="button" type="submit">Update Entry</button>
        </form>
    `;

    // Populate the select dropdown with tag options
    const tagDropdown = editEntryFormCont.querySelector('#inputEditDictTag');
    tagOrder.forEach((tag) => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagDropdown.appendChild(option);
    });

    // Append the edit entry form to the body
    document.body.appendChild(editEntryFormCont);
}

// Function to open the edit entry form
function openEditEntryForm(entryId) {

    if (!document.querySelector('.entryForm')) {
        generateEditEntryForm(entryId);
    } else if (document.getElementById('newEntryFormCont')) {
        closeEntryForm();
        generateEditEntryForm(entryId);
    }

    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dict').doc('dictionary');

    // Reference to the form fields
    const inputDictName = document.getElementById('inputEditDictName');
    const inputDictDef = document.getElementById('inputEditDictDef');
    const inputDictTag = document.getElementById('inputEditDictTag');
    const inputDictImgUrl = document.getElementById('inputEditDictImgUrl');
    const inputDictImgUrl2 = document.getElementById('inputEditDictImgUrl2');

    // Get the 'dictionary' document
    dictionaryCollection.get()
        .then((documentSnapshot) => {
            if (documentSnapshot.exists) {
                const data = documentSnapshot.data();
                if (data && data[entryId]) {
                    // Prefill the form fields with existing data
                    inputDictName.value = data[entryId].dictName;
                    inputDictDef.value = data[entryId].dictDef;
                    inputDictTag.value = data[entryId].dictTag;
                    inputDictImgUrl.value = data[entryId].dictImg || '';
                    inputDictImgUrl2.value = data[entryId].dictImg2 || '';
                } else {
                    console.error('Entry not found:', entryId);
                }
            } else {
                console.error('Dictionary document not found.');
            }
        })
        .catch((error) => {
            console.error('Error fetching entry data:', error);
        });
}


// Function to update an entry in Firestore
async function updateEntry(entryId) {
    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dict').doc('dictionary');

    // Reference to the form fields
    const inputDictName = document.getElementById('inputEditDictName');
    const inputDictDef = document.getElementById('inputEditDictDef');
    const inputDictTag = document.getElementById('inputEditDictTag');
    const inputDictImgUrl = document.getElementById('inputEditDictImgUrl');
    const inputDictImgFile = document.getElementById('inputEditDictImgFile').files[0];
    const inputDictImgUrl2 = document.getElementById('inputEditDictImgUrl2');
    const inputDictImgFile2 = document.getElementById('inputEditDictImgFile2').files[0];

    try {
        // Get the 'dictionary' document
        const documentSnapshot = await dictionaryCollection.get();

        if (!documentSnapshot.exists) {
            console.log('Dictionary document not found.');
            return;
        }

        const data = documentSnapshot.data();

        // Update the entry with the specified ID
        if (data && data[entryId]) {
            data[entryId].dictName = inputDictName.value;
            data[entryId].dictDef = inputDictDef.value;
            data[entryId].dictTag = inputDictTag.value;

            if (inputDictImgFile) {
                // If a new image is provided, upload it and get the URL
                data[entryId].dictImg = await uploadMedia(inputDictImgFile, inputDictName.value);
            } else {
                // Otherwise, use the provided URL in the text input
                data[entryId].dictImg = inputDictImgUrl.value || null;
            }

            if (inputDictImgFile2) {
                // If a new image is provided, upload it and get the URL
                data[entryId].dictImg2 = await uploadMedia(inputDictImgFile2, inputDictName.value);
            } else {
                // Otherwise, use the provided URL in the text input
                data[entryId].dictImg2 = inputDictImgUrl2.value || null;
            }

            // Ensure dictIndex remains unchanged
            const oldEntry = data[entryId];
            data[entryId].dictIndex = oldEntry.dictIndex;

            // Update the 'dictionary' document with the modified data
            await dictionaryCollection.set(data);

            // Close the edit entry form
            closeEntryForm();

            // Refresh the displayed entries after updating
            refreshSearch();
        } else {
            console.log(`Entry with ID ${entryId} not found in the dictionary.`);
        }
    } catch (error) {
        console.error('Error updating entry in Firestore:', error);
    }
}