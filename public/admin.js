//Check if the user is authenticated
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user || user.isAnonymous) {
        window.location.href = '/login';
        return;
    }

    try {
        if (!(await isAdminUser(user))) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error checking admin access:', error);
        window.location.href = '/login';
    }
});

const GUEST_ROUTINE_CLEANUP_DAYS = 7;
const BATCH_DELETE_LIMIT = 450;

async function flushOldAnonymousRoutines() {
    const status = document.getElementById('routineFlushStatus');
    const cutoff = Date.now() - (GUEST_ROUTINE_CLEANUP_DAYS * 24 * 60 * 60 * 1000);

    if (!confirm(`Delete guest routines older than ${GUEST_ROUTINE_CLEANUP_DAYS} days?`)) {
        return;
    }

    setRoutineFlushStatus('Finding old guest routines...');

    try {
        const snapshot = await db.collection('routines')
            .where('ownerIsAnonymous', '==', true)
            .get();

        const oldDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const createdAt = getFirestoreMillis(data.createdAt || data.updatedAt);
            return createdAt > 0 && createdAt < cutoff;
        });

        if (oldDocs.length === 0) {
            setRoutineFlushStatus('No old guest routines found.');
            return;
        }

        let deletedCount = 0;
        for (let index = 0; index < oldDocs.length; index += BATCH_DELETE_LIMIT) {
            const batch = db.batch();
            oldDocs.slice(index, index + BATCH_DELETE_LIMIT).forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += Math.min(BATCH_DELETE_LIMIT, oldDocs.length - index);
            setRoutineFlushStatus(`Deleted ${deletedCount} of ${oldDocs.length} old guest routines...`);
        }

        setRoutineFlushStatus(`Deleted ${deletedCount} old guest routine${deletedCount === 1 ? '' : 's'}.`);
    } catch (error) {
        console.error('Error flushing old guest routines:', error);
        setRoutineFlushStatus('Unable to flush old guest routines. Check console for details.');
    }

    function setRoutineFlushStatus(message) {
        if (status) {
            status.textContent = message;
        }
    }
}

function getFirestoreMillis(timestamp) {
    if (!timestamp) {
        return 0;
    }

    if (typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
    }

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }

    return 0;
}

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
        } else {
            const updates = {
                [`${entryId}.dictIndex`]: currentEntryIndex - 1,
            };

            await dictionaryCollection.update(updates);
        }

        // Refresh the displayed entries after moving
        refreshSearch({ refetch: true });

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
        refreshSearch({ refetch: true });

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
            <span class="entryFormNotice">To embed links to another entry, use {{Entry Name}} or {{Entry Name}}(Display Text)</span>
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
    if (entryForm) {
        entryForm.remove();
    }
}

// Cloudinary config — fill these in
const CLOUDINARY_CLOUD_NAME = 'dasbxvqpv'; // already known from your URLs
const CLOUDINARY_UPLOAD_PRESET = 'unsigned_upload'; // from Cloudinary dashboard → Settings → Upload Presets
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function uploadMedia(file, dictName) {
    if (file.size > MAX_FILE_SIZE) {
        alert("File is too large. Please select a file smaller than 5MB.");
        return null;
    }

    // Determine if image or video based on file type
    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    // Generate a filename slug from the entry name (same style as before)
    const randomString = Math.random().toString(36).substring(2, 7);
    const baseName = dictName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const publicId = `${baseName}-${randomString}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', publicId);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.secure_url;

    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        alert('Upload failed. Please try again.');
        return null;
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
            if (!mediaUrl) {
                return;
            }
        }
        if (inputDictImgFile2) {
            mediaUrl2 = await uploadMedia(inputDictImgFile2, inputDictName);
            if (!mediaUrl2) {
                return;
            }
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
                dictImg: mediaUrl || null,
                dictImg2: mediaUrl2 || null,
                dictIndex: newIndex
            }
        });

        // Close the entry form
        closeEntryForm();

        // Refresh the displayed entries after adding
        refreshSearch({ refetch: true });
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
    // Display a confirmation dialog
    const confirmation = confirm("Are you sure you want to delete this entry? This action cannot be undone.");

    if (!confirmation) {
        // If the user clicks "Cancel", do nothing
        return;
    }

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
        refreshSearch({ refetch: true });
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
            <span class="entryFormNotice">To embed links to another entry, use {{Entry Name}} or {{Entry Name}}(Display Text)</span>
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

        if (!data || !data[entryId]) {
            console.log(`Entry with ID ${entryId} not found in the dictionary.`);
            return;
        }

        const currentEntry = data[entryId];
        const nextName = inputDictName.value.trim();
        const nextDef = inputDictDef.value.trim();
        const nextTag = inputDictTag.value.trim();
        let nextImg = inputDictImgUrl.value.trim() || null;
        let nextImg2 = inputDictImgUrl2.value.trim() || null;

        if (inputDictImgFile) {
            // If a new image is provided, upload it and get the URL
            nextImg = await uploadMedia(inputDictImgFile, nextName);
            if (!nextImg) {
                return;
            }
        }

        if (inputDictImgFile2) {
            // If a new image is provided, upload it and get the URL
            nextImg2 = await uploadMedia(inputDictImgFile2, nextName);
            if (!nextImg2) {
                return;
            }
        }

        const updates = {};
        addChangedEntryField(updates, entryId, 'dictName', currentEntry.dictName, nextName);
        addChangedEntryField(updates, entryId, 'dictDef', currentEntry.dictDef, nextDef);
        addChangedEntryField(updates, entryId, 'dictTag', currentEntry.dictTag, nextTag);
        addChangedEntryField(updates, entryId, 'dictImg', currentEntry.dictImg || null, nextImg);
        addChangedEntryField(updates, entryId, 'dictImg2', currentEntry.dictImg2 || null, nextImg2);

        if (Object.keys(updates).length > 0) {
            await dictionaryCollection.update(updates);
        }

        // Close the edit entry form
        closeEntryForm();

        // Refresh the displayed entries after updating
        refreshSearch({ refetch: true });
    } catch (error) {
        console.error('Error updating entry in Firestore:', error);
    }
}

function addChangedEntryField(updates, entryId, fieldName, currentValue, nextValue) {
    if (currentValue !== nextValue) {
        updates[`${entryId}.${fieldName}`] = nextValue;
    }
}
