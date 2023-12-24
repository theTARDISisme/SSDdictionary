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

async function moveEntryUp(entryId) {
    try {
        const entryRef = db.collection('dictionary').doc(entryId);

        // Get the current entry's data
        const currentEntrySnapshot = await entryRef.get();
        const currentEntryData = currentEntrySnapshot.data();
        const currentEntryIndex = currentEntryData.dictIndex;
        const currentEntryTag = currentEntryData.dictTag;

        if (currentEntryIndex === 0) {
            // Entry is already at the top, no need to move up
            console.log('Entry is already at the top.');
            return;
        }

        // Find the lower entry within the same category
        const lowerEntrySnapshot = await db.collection('dictionary')
            .where('dictTag', '==', currentEntryTag)
            .where('dictIndex', '==', currentEntryIndex - 1)
            .limit(1)
            .get();

        // Update the current entry's index
        await db.runTransaction(async (transaction) => {
            transaction.update(entryRef, {dictIndex: firebase.firestore.FieldValue.increment(-1)});
        });

        if (!lowerEntrySnapshot.empty) {
            const lowerEntryRef = lowerEntrySnapshot.docs[0].ref;

            // Update the lower entry's index
            await db.runTransaction(async (transaction) => {
                transaction.update(lowerEntryRef, {dictIndex: firebase.firestore.FieldValue.increment(1)});
            });
        }
        // Refresh the displayed entries after moving
        refreshSearch();

    } catch (error) {
        console.error('Error moving entry up:', error);
    }
}

async function moveEntryDown(entryId) {
    try {
        const entryRef = db.collection('dictionary').doc(entryId);

        // Get the current entry's data
        const currentEntrySnapshot = await entryRef.get();
        const currentEntryData = currentEntrySnapshot.data();
        const currentEntryIndex = currentEntryData.dictIndex;
        const currentEntryTag = currentEntryData.dictTag;

        // Find the higher entry within the same category
        const higherEntrySnapshot = await db.collection('dictionary')
            .where('dictTag', '==', currentEntryTag)
            .where('dictIndex', '==', currentEntryIndex + 1)
            .limit(1)
            .get();

        // Update the current entry's index
        await db.runTransaction(async (transaction) => {
            transaction.update(entryRef, {dictIndex: firebase.firestore.FieldValue.increment(1)});
        });

        if (!higherEntrySnapshot.empty) {
            const higherEntryRef = higherEntrySnapshot.docs[0].ref;

            // Update the higher entry's index
            await db.runTransaction(async (transaction) => {
                transaction.update(higherEntryRef, {dictIndex: firebase.firestore.FieldValue.increment(-1)});
            });
        }

        console.log('Entry moved down successfully.');
        // Refresh the displayed entries after the move
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
            <label for="inputDictImg">GIF/Image URL (optional): </label>
            <input type="text" id="inputDictImg">
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

// Function to create a new entry in Firestore
async function addEntry() {
    const inputDictName = document.getElementById('inputDictName').value.trim();
    const inputDictDef = document.getElementById('inputDictDef').value.trim();
    const inputDictTag = document.getElementById('inputDictTag').value.trim();
    const inputDictImg = document.getElementById('inputDictImg').value.trim();

    // Generate Firestore document ID
    let entryId = generateFirestoreId(inputDictName);

    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dictionary');

    try {
        // Check if the entry with the same ID already exists
        let entrySnapshot = await dictionaryCollection.doc(entryId).get();

        // Regenerate ID if entry already exists
        while (entrySnapshot.exists) {
            entryId = generateFirestoreId(inputDictName);
            entrySnapshot = await dictionaryCollection.doc(entryId).get();
        }

        // Query Firestore to find the max dictIndex for the current category (dictTag)
        const maxIndexSnapshot = await dictionaryCollection
            .where('dictTag', '==', inputDictTag)
            .orderBy('dictIndex', 'desc')
            .limit(1)
            .get();

        let newIndex = 0;
        if (!maxIndexSnapshot.empty) {
            // If there are existing entries in the category, set newIndex to the next available index
            const maxIndexEntry = maxIndexSnapshot.docs[0].data();
            newIndex = maxIndexEntry.dictIndex + 1;
        }

        // Create a new entry in Firestore with the calculated dictIndex
        await dictionaryCollection.doc(entryId).set({
            dictName: inputDictName,
            dictDef: inputDictDef,
            dictTag: inputDictTag,
            dictImg: inputDictImg,
            dictIndex: newIndex
        });

        // Close the entry form
        closeEntryForm();

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
    const dictionaryCollection = db.collection('dictionary');

    try {
        // Delete the entry with the specified ID
        await dictionaryCollection.doc(entryId).delete();

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
            <label for="inputEditDictImg">GIF/Image URL (optional): </label>
            <input type="text" id="inputEditDictImg">
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
    const dictionaryCollection = db.collection('dictionary');

    // Reference to the form fields
    const inputDictName = document.getElementById('inputEditDictName');
    const inputDictDef = document.getElementById('inputEditDictDef');
    const inputDictTag = document.getElementById('inputEditDictTag');
    const inputDictImg = document.getElementById('inputEditDictImg');

    // Get the existing entry data
    dictionaryCollection.doc(entryId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                // Prefill the form fields with existing data
                inputDictName.value = data.dictName;
                inputDictDef.value = data.dictDef;
                inputDictTag.value = data.dictTag;
                inputDictImg.value = data.dictImg || '';
            } else {
                console.error('Entry not found:', entryId);
            }
        })
        .catch((error) => {
            console.error('Error fetching entry data:', error);
        });
}

// Function to update an entry in Firestore
async function updateEntry(entryId) {
    // Reference to the Firestore collection
    const dictionaryCollection = db.collection('dictionary');

    // Reference to the form fields
    const inputDictName = document.getElementById('inputEditDictName');
    const inputDictDef = document.getElementById('inputEditDictDef');
    const inputDictTag = document.getElementById('inputEditDictTag');
    const inputDictImg = document.getElementById('inputEditDictImg');

    try {
        // Update the entry with the specified ID
        await dictionaryCollection.doc(entryId).update({
            dictName: inputDictName.value,
            dictDef: inputDictDef.value,
            dictTag: inputDictTag.value,
            dictImg: inputDictImg.value || null, // Use null if inputDictImg is empty
        });

        // Close the edit entry form
        closeEntryForm();

        // Refresh the displayed entries after updating
        refreshSearch();
    } catch (error) {
        console.error('Error updating entry in Firestore:', error);
    }
}



