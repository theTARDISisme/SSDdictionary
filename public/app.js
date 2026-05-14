const tagOrder = ['The Arena', 'Fundamentals', 'Alignment', 'Meter System', 'Flats & Exits', 'Circle Moves', 'Follow Moves', 'Beginner', 'Intermediate', 'Advanced', 'Elite'];

// Array to store local data
let localData = [];

const dictReferenceRegex = /\{\{([^}]+?)\}\}(\(([^)]+?)\))?/g;
const routineCollectionName = 'routines';
const routineIdParam = 'routine';
const routineStorageKey = 'ssdCurrentRoutineId';
const routineDraftStorageKey = 'ssdRoutineDraft';
const maxRoutineItems = 200;
const routineSaveDelay = 3000;
const routineViewParam = 'view';

let routineState = {
    id: null,
    title: 'Untitled routine',
    ownerUid: null,
    ownerIsAnonymous: true,
    items: [],
    canEdit: true,
    viewMode: false,
    saveTimer: null,
    dragIndex: null
};

let routineSummaries = [];
let lastRoutineAuthError = null;
let routineToastTimer = null;
let routinePointerDrag = null;

function normalizeSearchText(value) {
    return String(value || '').toLowerCase();
}

function getVisibleDictDef(dictDef = '') {
    const regex = new RegExp(dictReferenceRegex.source, 'g');
    return String(dictDef || '').replace(regex, (match, searchTerm, group2, displayText) => {
        return (displayText || searchTerm).trim();
    });
}

function getSearchValues() {
    return {
        searchTerm: document.querySelector('.searchBar').value.trim(),
        searchCategory: document.querySelector('.searchCategory').value.trim()
    };
}

function refreshDisplayedEntries() {
    const { searchTerm, searchCategory } = getSearchValues();
    loadLocalData(searchTerm, searchCategory);
}

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
            dictionaryContainer.textContent = 'No dictionary entries found.';
            return false;
        }

        const data = documentSnapshot.data();

        // Convert the map to an array of entries
        localData = Object.entries(data);
        return true;
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
        return false;
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
        const term = normalizeSearchText(searchTerm);
        const visibleDictDef = getVisibleDictDef(entryData.dictDef);
        switch (searchCategory) {
            case 'dictName':
                return normalizeSearchText(entryData.dictName).includes(term);
            case 'dictDef':
                return normalizeSearchText(visibleDictDef).includes(term);
            case 'dictTag':
                return normalizeSearchText(entryData.dictTag).includes(term);
            case 'all':
            default:
                return (
                    normalizeSearchText(entryData.dictName).includes(term) ||
                    normalizeSearchText(visibleDictDef).includes(term)
                );
        }
    });

    // Sort and display like before
    filteredDocs.sort((a, b) => {
        const tagComparison = tagOrder.indexOf(a[1].dictTag) - tagOrder.indexOf(b[1].dictTag);
        return tagComparison !== 0 ? tagComparison : a[1].dictIndex - b[1].dictIndex;
    });

    filteredDocs.forEach(([entryId, data]) => {
        createDictionaryEntry({ ...data, entryId });
    });

    return localData;
}

function populateCategoryDropdown() {
    const dropdownContent = document.getElementById('categoryDropdownContent');
    dropdownContent.replaceChildren();

    const heading = document.createElement('b');
    heading.textContent = 'Filter Categories';
    dropdownContent.appendChild(heading);

    tagOrder.forEach(tag => {
        const label = document.createElement('label');
        label.classList.add('block');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('categoryCheckbox');
        checkbox.value = tag;

        // Add change listener for live filtering
        checkbox.addEventListener('change', refreshDisplayedEntries);

        label.appendChild(checkbox);
        label.append(` ${tag}`);
        dropdownContent.appendChild(label);
    });
}

async function refreshSearch(options = {}) {
    const shouldRefetch = options.refetch || localData.length === 0;

    if (shouldRefetch) {
        const didFetch = await fetchInitialData();
        if (!didFetch) {
            return;
        }
    }

    refreshDisplayedEntries();
}


window.onload = function () {
    populateCategoryDropdown();


    document.querySelector('.categoryDropdownToggle').addEventListener('click', function () {
        this.classList.toggle('active');
    });

// Function to handle search input changes
    document.querySelector('.searchBar').addEventListener('input', refreshDisplayedEntries);

// Function to handle dropdown (select) changes
    document.querySelector('.searchCategory').addEventListener('change', refreshDisplayedEntries);

    const toggleButton = document.getElementById('categoryFilterButton');
    const dropdownWrapper = document.getElementById('categoryFilter');

    document.addEventListener('click', function (e) {
        if (!dropdownWrapper.contains(e.target)) {
            toggleButton.classList.remove('active');
        }
    });


// Initially load all entries
    refreshSearch({ refetch: true }).then(initRoutineFeature);
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
    const mediaPlaceholder = media.querySelector('[data-dict-img]');
    const mediaPlaceholder2 = media.querySelector('[data-dict-img2]');

    // Check if media is loaded by looking at a data attribute
    if (!media.dataset.loaded) {
        const dictImg = mediaPlaceholder ? mediaPlaceholder.dataset.dictImg : '';
        const dictImg2 = mediaPlaceholder2 ? mediaPlaceholder2.dataset.dictImg2 : '';

        // Load the first image if available
        if (dictImg) {
            const mediaElement = await createMediaElement(dictImg);
            mediaPlaceholder.replaceChildren();
            if (mediaElement) {
                mediaPlaceholder.appendChild(mediaElement);
                await setMediaDimensions(mediaPlaceholder);
            } else {
                mediaPlaceholder.textContent = 'Unable to load media.';
            }
        }

        // Load the second image if available
        if (dictImg2) {
            const mediaElement = await createMediaElement(dictImg2);
            mediaPlaceholder2.replaceChildren();
            if (mediaElement) {
                mediaPlaceholder2.appendChild(mediaElement);
                await setMediaDimensions(mediaPlaceholder2);
            } else {
                mediaPlaceholder2.textContent = 'Unable to load media.';
            }
        }

        // Set the data attribute to indicate that the media has been loaded
        media.dataset.loaded = 'true';


    }

    // Toggle the visibility of the image
    if (media.style.display === 'none' || media.style.display === '') {
        media.style.display = 'flex';
        iconElement.textContent = '▲';
        iconElement.title = 'Collapse Media';
    } else {
        media.style.display = 'none';
        iconElement.textContent = '▼';
        iconElement.title = 'Expand Media';
    }
}

async function fetchContentType(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type');

        if (!contentType) {
            return null;
        }

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
        const image = document.createElement('img');
        image.classList.add('dictImg');
        image.src = url;
        image.alt = 'Image';
        return image;
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.classList.add('dictVideo');
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        const source = document.createElement('source');
        source.src = url;
        source.type = 'video/mp4';
        video.appendChild(source);
        video.append('Your browser does not support the video tag.');
        return video;
    } else {
        return null;
    }
}

// Function to create a dictionary entry with dynamic links
function createDictionaryEntry(data, insertAfter = null, fromLink = false, options = {}) {
    const entry = document.createElement('div');
    entry.classList.add('dictEntry');

    const docId = data.entryId;
    // Check if it's on the admin page and add buttons if true
    const isAdminPage = document.getElementById('adminDictionaryContainer') !== null;

    entry.dataset.docId = data.entryId;
    entry.dataset.dictIndex = data.dictIndex;

    // Add the class "fromLink" if the entry is being created from a clicked link
    if (fromLink) {
        entry.classList.add('fromLink');
    }

    if (options.embedded) {
        entry.classList.add('embeddedDictEntry');
    }

    entry.setAttribute('data-doc-id', docId);

    const dictText = document.createElement('div');
    dictText.classList.add('dictText');

    if (isAdminPage) {
        dictText.appendChild(createAdminButtonsElement(data.entryId, data.dictIndex));
    }

    const dictName = document.createElement('p');
    dictName.classList.add('dictName');
    dictName.textContent = data.dictName || '';
    dictText.appendChild(dictName);

    const dictSpacer = document.createElement('p');
    dictSpacer.classList.add('dictSpacer');
    dictSpacer.textContent = '-';
    dictText.appendChild(dictSpacer);

    const dictDef = document.createElement('p');
    dictDef.classList.add('dictDef');
    dictDef.appendChild(createParsedDictDefFragment(data.dictDef, docId));
    dictText.appendChild(dictDef);

    const dictTag = document.createElement('p');
    dictTag.classList.add('dictTag');
    dictTag.textContent = data.dictTag || '';

    if (fromLink) {
        const closeButton = document.createElement('span');
        closeButton.classList.add('closeEntryButton', 'buttonIcon');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => closeEntry(closeButton));
        dictTag.append(' ');
        dictTag.appendChild(closeButton);
    }

    dictText.appendChild(dictTag);

    const entryActions = document.createElement('div');
    entryActions.classList.add('entryActions');

    const canAddToRoutine = document.getElementById('routine-panel')
        && !isAdminPage
        && !options.embedded
        && routineState.canEdit
        && !routineState.viewMode;

    if (canAddToRoutine) {
        const routineAddButton = document.createElement('button');
        routineAddButton.type = 'button';
        routineAddButton.classList.add('routineAddIcon');
        routineAddButton.title = 'Add to routine';
        routineAddButton.textContent = '+';
        routineAddButton.addEventListener('click', () => addDictionaryEntryToRoutine(data));
        entryActions.appendChild(routineAddButton);
    }

    if (data.dictImg || data.dictImg2) {
        const dropdownIcon = document.createElement('div');
        dropdownIcon.classList.add('dropdownIcon', 'buttonIcon');
        dropdownIcon.title = 'Load Media';
        dropdownIcon.addEventListener('click', () => toggleDropdown(dropdownIcon));

        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-photo-film');
        icon.title = 'Load Media';
        dropdownIcon.appendChild(icon);
        entryActions.appendChild(dropdownIcon);
    }

    if (entryActions.children.length > 0) {
        dictText.appendChild(entryActions);
    }

    const dictMedia = document.createElement('div');
    dictMedia.classList.add('dictMedia');

    if (data.dictImg) {
        dictMedia.appendChild(createMediaPlaceholder(data.dictImg, 'dictImg'));
    }

    if (data.dictImg2) {
        dictMedia.appendChild(createMediaPlaceholder(data.dictImg2, 'dictImg2'));
    }

    entry.appendChild(dictText);
    entry.appendChild(dictMedia);

    if (options.append === false) {
        return entry;
    }

    // Insert the entry after the specified position or append it to the end
    const dictionaryContainer = options.container || document.getElementById('dictionary-container');
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

function createMediaPlaceholder(url, datasetKey) {
    const mediaPlaceholder = document.createElement('div');
    mediaPlaceholder.classList.add('mediaPlaceholder');
    mediaPlaceholder.dataset[datasetKey] = url;
    mediaPlaceholder.textContent = 'Loading media...';
    return mediaPlaceholder;
}

function createAdminButtonsElement(docId, dictIndex) {
    const fragment = document.createDocumentFragment();

    const index = document.createElement('p');
    index.classList.add('dictIndex');
    index.textContent = dictIndex;
    fragment.appendChild(index);

    const buttons = document.createElement('div');
    buttons.classList.add('adminButtons');
    buttons.appendChild(createAdminIconButton('upButton', '↑', 'Move entry up', () => moveEntryUp(docId)));
    buttons.appendChild(createAdminIconButton('downButton', '↓', 'Move entry down', () => moveEntryDown(docId)));
    buttons.appendChild(createAdminIconButton('deleteButton', '×', 'Delete entry', () => deleteEntry(docId)));
    buttons.appendChild(createAdminIconButton('editButton', '✎', 'Edit entry', () => openEditEntryForm(docId)));
    fragment.appendChild(buttons);

    return fragment;
}

function createAdminIconButton(className, text, title, onClick) {
    const button = document.createElement('span');
    button.classList.add(className, 'buttonIcon');
    button.title = title;
    button.setAttribute('aria-label', title);

    if (className === 'deleteButton') {
        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-trash-can');
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
    } else {
        button.textContent = text;
    }

    button.addEventListener('click', onClick);
    return button;
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
function createParsedDictDefFragment(dictDef, docId) {
    const fragment = document.createDocumentFragment();
    const source = String(dictDef || '');
    const regex = new RegExp(dictReferenceRegex.source, 'g');
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(source)) !== null) {
        fragment.append(source.slice(lastIndex, match.index));

        const linkSearchTerm = match[1].trim();
        const linkText = (match[3] || linkSearchTerm).trim();
        const link = document.createElement('span');
        link.classList.add('dictLink');
        link.textContent = linkText;
        link.addEventListener('click', () => handleDictLinkClick(linkSearchTerm, docId, link));
        fragment.appendChild(link);

        lastIndex = regex.lastIndex;
    }

    fragment.append(source.slice(lastIndex));
    return fragment;
}

function parseDictDef(dictDef) {
    return getVisibleDictDef(dictDef);
}


// Function to handle click on dynamic links in dictDef
async function handleDictLinkClick(referencedDictName, docId, linkElement) {
    const searchTerm = referencedDictName.trim().toLowerCase();

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

function initRoutineFeature() {
    if (!document.getElementById('routine-panel')) {
        return;
    }

    document.getElementById('routine-title').addEventListener('input', handleRoutineTitleInput);
    document.getElementById('routine-new-btn').addEventListener('click', startNewRoutine);
    document.getElementById('routine-add-note-btn').addEventListener('click', addRoutineNote);
    document.getElementById('routine-share-btn').addEventListener('click', shareCurrentRoutine);
    const deleteButton = document.getElementById('routine-delete-btn');
    if (deleteButton) {
        deleteButton.addEventListener('click', deleteCurrentRoutine);
    }
    document.getElementById('routine-view-btn').addEventListener('click', toggleRoutineViewMode);
    document.getElementById('routine-google-btn').addEventListener('click', signInRoutineWithGoogle);
    document.getElementById('routine-signout-btn').addEventListener('click', signOutRoutineUser);
    auth.onAuthStateChanged(syncRoutineAuthUi);

    routineState.viewMode = getRoutineViewModeFromUrl();

    const routineIdFromUrl = getRoutineIdFromUrl();
    const cachedRoutineId = localStorage.getItem(routineStorageKey);

    if (routineIdFromUrl) {
        loadRoutine(routineIdFromUrl, { source: 'url' });
    } else if (cachedRoutineId) {
        loadRoutine(cachedRoutineId, { source: 'cache' });
    } else {
        loadRoutineDraft();
        renderRoutinePanel();
    }

    loadRoutineList();
}

function getRoutineIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get(routineIdParam);
}

function getRoutineViewModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get(routineViewParam) === '1';
}

function setRoutineUrl(routineId) {
    const url = new URL(window.location.href);

    if (routineId) {
        url.searchParams.set(routineIdParam, routineId);
    } else {
        url.searchParams.delete(routineIdParam);
    }

    window.history.replaceState(null, '', url);
}

function setRoutineViewUrl(isViewMode) {
    const url = new URL(window.location.href);

    if (isViewMode) {
        url.searchParams.set(routineViewParam, '1');
    } else {
        url.searchParams.delete(routineViewParam);
    }

    window.history.replaceState(null, '', url);
}

function loadRoutineDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem(routineDraftStorageKey) || 'null');
        if (draft && Array.isArray(draft.items)) {
            routineState.title = draft.title || 'Untitled routine';
            routineState.items = draft.items.slice(0, maxRoutineItems);
        }
    } catch (error) {
        console.error('Error loading routine draft:', error);
    }
}

function saveRoutineDraft() {
    const draft = {
        title: routineState.title,
        items: sanitizeRoutineItems(routineState.items)
    };

    localStorage.setItem(routineDraftStorageKey, JSON.stringify(draft));
}

function setGoogleButtonLabel(button, label) {
    const labelElement = button.querySelector('.googleButtonText');

    if (labelElement) {
        labelElement.textContent = label;
    } else {
        button.textContent = label;
    }
}

function syncRoutineAuthUi() {
    const status = document.getElementById('routine-auth-status');
    const googleButton = document.getElementById('routine-google-btn');
    const signOutButton = document.getElementById('routine-signout-btn');

    if (!status || !googleButton || !signOutButton) {
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        status.textContent = 'Guest routines save in this browser, but you may lose edit access later. Sign in to keep them permanently.';
        googleButton.disabled = false;
        googleButton.hidden = false;
        setGoogleButtonLabel(googleButton, 'Sign in to save');
        signOutButton.disabled = true;
        signOutButton.hidden = true;
        return;
    }

    if (user.isAnonymous) {
        status.textContent = 'Guest routines save in this browser, but you may lose edit access later. Sign in to keep them permanently.';
        googleButton.disabled = false;
        googleButton.hidden = false;
        setGoogleButtonLabel(googleButton, 'Sign in to save');
        signOutButton.disabled = true;
        signOutButton.hidden = true;
        return;
    }

    status.textContent = `Signed in as ${user.displayName || user.email || 'Google user'}.`;
    googleButton.disabled = true;
    googleButton.hidden = true;
    setGoogleButtonLabel(googleButton, 'Signed in');
    signOutButton.disabled = false;
    signOutButton.hidden = false;
}

async function signInRoutineWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const currentUser = auth.currentUser || await waitForAuthReady();

        if (currentUser && currentUser.isAnonymous && routineState.canEdit && routineState.items.length > 0) {
            clearTimeout(routineState.saveTimer);
            await saveCurrentRoutine();
        }

        const previousAnonymousUid = currentUser && currentUser.isAnonymous ? currentUser.uid : null;
        const previousRoutineIds = getCurrentRoutineIdsForMigration();
        const hadRoutineId = Boolean(routineState.id);
        const hasDraftContent = routineState.items.length > 0 || routineState.title !== 'Untitled routine';

        if (currentUser && currentUser.isAnonymous) {
            try {
                await currentUser.linkWithPopup(provider);
            } catch (error) {
                if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/email-already-in-use') {
                    await auth.signInWithPopup(provider);
                } else {
                    throw error;
                }
            }
        } else {
            await auth.signInWithPopup(provider);
        }

        syncRoutineAuthUi();
        await migrateAnonymousRoutinesAfterGoogleSignIn(previousAnonymousUid, previousRoutineIds);

        if (hadRoutineId && routineState.id) {
            await loadRoutine(routineState.id);
        } else if (hasDraftContent) {
            routineState.canEdit = true;
            routineState.ownerUid = auth.currentUser ? auth.currentUser.uid : routineState.ownerUid;
            await saveCurrentRoutine();
        }

        await loadRoutineList();

        if (routineState.id) {
            setRoutineStatus('Signed in with Google.');
        }
    } catch (error) {
        console.error('Error signing in with Google:', error);
        setRoutineStatus(`Google sign-in failed: ${getFriendlyAuthError(error)}`);
    }
}

function getCurrentRoutineIdsForMigration() {
    const ids = routineSummaries.map(routine => routine.id);
    if (routineState.id) {
        ids.push(routineState.id);
    }

    return Array.from(new Set(ids.filter(Boolean)));
}

async function migrateAnonymousRoutinesAfterGoogleSignIn(previousAnonymousUid, previousRoutineIds) {
    const user = auth.currentUser;

    if (!user || user.isAnonymous || !previousAnonymousUid) {
        return;
    }

    if (user.uid === previousAnonymousUid) {
        const snapshot = await db.collection(routineCollectionName)
            .where('ownerUid', '==', user.uid)
            .get();

        const guestDocs = snapshot.docs.filter(doc => doc.data().ownerIsAnonymous === true);

        if (guestDocs.length === 0) {
            return;
        }

        const batch = db.batch();
        guestDocs.forEach(doc => {
            batch.update(doc.ref, {
                ownerIsAnonymous: false,
                expiresAt: firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        routineState.ownerIsAnonymous = false;
        return;
    }

    let copiedCurrentRoutineId = null;

    for (const routineId of previousRoutineIds) {
        const routineDoc = await db.collection(routineCollectionName).doc(routineId).get();

        if (!routineDoc.exists) {
            continue;
        }

        const data = routineDoc.data();
        if (data.ownerUid !== previousAnonymousUid || data.ownerIsAnonymous !== true) {
            continue;
        }

        const newDoc = db.collection(routineCollectionName).doc();
        await newDoc.set({
            title: data.title || 'Untitled routine',
            ownerUid: user.uid,
            ownerIsAnonymous: false,
            items: sanitizeRoutineItems(Array.isArray(data.items) ? data.items : []),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (routineId === routineState.id) {
            copiedCurrentRoutineId = newDoc.id;
        }
    }

    if (copiedCurrentRoutineId) {
        routineState.id = copiedCurrentRoutineId;
        routineState.ownerUid = user.uid;
        routineState.ownerIsAnonymous = false;
        localStorage.setItem(routineStorageKey, routineState.id);
        setRoutineUrl(routineState.id);
    }
}

async function signOutRoutineUser() {
    try {
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            return;
        }

        clearTimeout(routineState.saveTimer);
        await auth.signOut();
        routineSummaries = [];
        localStorage.removeItem(routineStorageKey);
        startNewRoutine();
        syncRoutineAuthUi();
        await loadRoutineList();
    } catch (error) {
        console.error('Error signing out:', error);
        setRoutineStatus('Unable to sign out.');
    }
}

async function loadRoutineList() {
    const list = document.getElementById('routine-list');

    if (!list) {
        return;
    }

    setRoutineLibraryStatus('Loading your routines...');

    try {
        const user = await getRoutineUser(true);

        if (!user) {
            setRoutineLibraryStatus(getRoutineAuthSetupMessage());
            renderRoutineList([]);
            return;
        }

        const snapshot = await db.collection(routineCollectionName)
            .where('ownerUid', '==', user.uid)
            .get();

        routineSummaries = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: doc.id,
                title: data.title || 'Untitled routine',
                itemCount: Array.isArray(data.items) ? data.items.length : 0,
                updatedAt: data.updatedAt || data.createdAt || null,
                ownerIsAnonymous: data.ownerIsAnonymous === true
            };
        }).filter(Boolean).sort((a, b) => getRoutineTime(b.updatedAt) - getRoutineTime(a.updatedAt));

        renderRoutineList(routineSummaries);
        setRoutineLibraryStatus(routineSummaries.length ? '' : 'No saved routines yet.');
    } catch (error) {
        console.error('Error loading routines:', error);
        setRoutineLibraryStatus('Unable to load your routines.');
    }
}

function renderRoutineList(routines) {
    const list = document.getElementById('routine-list');

    if (!list) {
        return;
    }

    list.replaceChildren();

    if (routines.length === 0) {
        const empty = document.createElement('p');
        empty.classList.add('routineEmpty');
        empty.textContent = 'Saved routines will appear here.';
        list.appendChild(empty);
        return;
    }

    routines.forEach(routine => {
        list.appendChild(createRoutineListItem(routine));
    });
}

function createRoutineListItem(routine) {
    const item = document.createElement('div');
    item.classList.add('routineListItem');
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.title = 'Open routine';
    item.addEventListener('click', () => loadRoutine(routine.id, { source: 'user' }));
    item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            loadRoutine(routine.id, { source: 'user' });
        }
    });

    if (routine.id === routineState.id) {
        item.classList.add('active');
    }

    const deleteButton = createRoutineListDeleteButton(routine.id);
    item.appendChild(deleteButton);

    const title = document.createElement('p');
    title.classList.add('routineListTitle');
    title.textContent = routine.title;
    item.appendChild(title);

    const meta = document.createElement('p');
    meta.classList.add('routineListMeta');
    meta.textContent = `${routine.itemCount} item${routine.itemCount === 1 ? '' : 's'}${formatRoutineDate(routine.updatedAt)}${routine.ownerIsAnonymous ? ' \u2022 guest' : ''}`;
    item.appendChild(meta);

    return item;
}

function createRoutineListDeleteButton(routineId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('routineListDeleteButton');
    button.title = 'Delete routine';
    button.setAttribute('aria-label', 'Delete routine');
    button.addEventListener('click', event => {
        event.stopPropagation();
        deleteRoutineById(routineId);
    });
    button.addEventListener('keydown', event => {
        event.stopPropagation();
    });

    const icon = document.createElement('i');
    icon.classList.add('fa-solid', 'fa-trash-can');
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);

    return button;
}

function getRoutineTime(timestamp) {
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

function formatRoutineDate(timestamp) {
    const time = getRoutineTime(timestamp);

    if (!time) {
        return '';
    }

    return ` \u2022 ${new Date(time).toLocaleDateString()}`;
}

async function loadRoutine(routineId, options = {}) {
    const source = options.source || 'user';
    setRoutineStatus('Loading routine...');

    try {
        const routineDoc = await db.collection(routineCollectionName).doc(routineId).get();

        if (!routineDoc.exists) {
            localStorage.removeItem(routineStorageKey);
            startNewRoutine(false);
            setRoutineStatus('Routine not found. Starting a new one.');
            return;
        }

        const data = routineDoc.data();
        const user = await getRoutineUser(true);

        routineState.id = routineDoc.id;
        routineState.title = data.title || 'Untitled routine';
        routineState.ownerUid = data.ownerUid || null;
        routineState.ownerIsAnonymous = data.ownerIsAnonymous === true;
        routineState.items = Array.isArray(data.items) ? data.items.slice(0, maxRoutineItems) : [];
        routineState.canEdit = Boolean(user && data.ownerUid === user.uid);
        routineState.viewMode = (source === 'url' && getRoutineViewModeFromUrl()) || !routineState.canEdit;

        if (!routineState.canEdit && source === 'cache') {
            localStorage.removeItem(routineStorageKey);
            startNewRoutine(false);
            setRoutineStatus('Starting a new routine. Open shared routines from their share links.');
            return;
        }

        if (routineState.canEdit) {
            localStorage.setItem(routineStorageKey, routineState.id);
        }

        if (source !== 'cache') {
            setRoutineUrl(routineState.id);
            setRoutineViewUrl(routineState.viewMode);
        }

        document.getElementById('routine-share-box').hidden = true;
        renderRoutinePanel();
        setRoutineStatus(getLoadedRoutineStatus());
    } catch (error) {
        console.error('Error loading routine:', error);
        setRoutineStatus('Unable to load this routine.');
    }
}

function getLoadedRoutineStatus() {
    if (!routineState.canEdit) {
        return 'View-only shared routine.';
    }

    if (routineState.ownerIsAnonymous) {
        return 'Guest routine loaded. Sign in to keep edit access permanently.';
    }

    return 'Routine loaded. Changes save automatically.';
}

function renderRoutinePanel() {
    const titleInput = document.getElementById('routine-title');
    const addNoteButton = document.getElementById('routine-add-note-btn');
    const shareButton = document.getElementById('routine-share-btn');
    const deleteButton = document.getElementById('routine-delete-btn');
    const viewButton = document.getElementById('routine-view-btn');
    const itemsContainer = document.getElementById('routine-items');
    const isEditing = routineState.canEdit && !routineState.viewMode;

    updateRoutineViewModeClass();
    titleInput.value = routineState.title;
    titleInput.disabled = !isEditing;
    addNoteButton.disabled = !isEditing;
    shareButton.disabled = !routineState.id && routineState.items.length === 0;
    if (deleteButton) {
        deleteButton.disabled = !isEditing || !routineState.id;
    }
    viewButton.textContent = routineState.viewMode ? 'Edit Mode' : 'View Mode';
    viewButton.hidden = !routineState.canEdit && routineState.viewMode;
    itemsContainer.replaceChildren();
    renderRoutineList(routineSummaries);

    if (routineState.items.length === 0) {
        const empty = document.createElement('p');
        empty.classList.add('routineEmpty');
        empty.textContent = routineState.viewMode
            ? 'This routine has no visible items.'
            : routineState.canEdit
            ? 'Add moves with the + button on dictionary entries, or add a note.'
            : 'This shared routine has no items.';
        itemsContainer.appendChild(empty);
        return;
    }

    routineState.items.forEach((item, index) => {
        const routineItem = createRoutineItemElement(item, index);
        if (routineItem) {
            itemsContainer.appendChild(routineItem);
        }
    });
}

function createRoutineItemElement(item, index) {
    const isEditing = routineState.canEdit && !routineState.viewMode;
    const row = document.createElement('div');
    row.classList.add('routineItem');
    row.dataset.index = index;

    if (isEditing) {
        row.draggable = true;
        row.addEventListener('dragstart', handleRoutineDragStart);
        row.addEventListener('dragend', handleRoutineDragEnd);
        row.addEventListener('dragover', handleRoutineDragOver);
        row.addEventListener('drop', handleRoutineDrop);
    }

    const dragHandle = document.createElement('span');
    dragHandle.classList.add('routineDragHandle');
    dragHandle.setAttribute('aria-hidden', 'true');
    dragHandle.title = isEditing ? 'Drag to reorder' : 'Routine item';
    if (isEditing) {
        dragHandle.addEventListener('pointerdown', handleRoutinePointerDragStart);
    }
    row.appendChild(dragHandle);

    const main = document.createElement('div');
    main.classList.add('routineItemMain');

    if (item.type === 'note') {
        if (isEditing) {
            main.appendChild(createRoutineTextarea(item.text || '', 'Note text', false, value => {
                item.text = value;
                scheduleRoutineSave();
            }));
        } else if (String(item.text || '').trim()) {
            main.appendChild(createRoutineNoteDisplay(item.text, true));
        } else {
            return null;
        }
    } else {
        const entry = findDictionaryEntry(item.entryId);
        const entryData = entry ? entry[1] : null;

        if (entryData) {
            main.appendChild(createDictionaryEntry({ ...entryData, entryId: item.entryId }, null, false, {
                append: false,
                embedded: true
            }));
        } else {
            main.appendChild(createRoutineItemTitle(item.entryName || 'Dictionary entry'));
            const meta = document.createElement('p');
            meta.classList.add('routineItemMeta');
            meta.textContent = 'This move could not be found in the current dictionary.';
            main.appendChild(meta);
        }

        if (isEditing) {
            main.appendChild(createRoutineTextarea(item.note || '', 'Notes for this move', false, value => {
                item.note = value;
                scheduleRoutineSave();
            }));
        } else if (String(item.note || '').trim()) {
            main.appendChild(createRoutineNoteDisplay(item.note));
        }
    }

    row.appendChild(main);

    const controls = document.createElement('div');
    controls.classList.add('routineItemControls');

    controls.appendChild(createRoutineIconButton('\u2191', 'Move up', () => moveRoutineItem(index, index - 1), !isEditing || index === 0));
    controls.appendChild(createRoutineIconButton('\u2193', 'Move down', () => moveRoutineItem(index, index + 1), !isEditing || index === routineState.items.length - 1));
    controls.appendChild(createRoutineIconButton('', 'Remove from routine', () => removeRoutineItem(index), !isEditing, ['fa-solid', 'fa-trash-can']));
    row.appendChild(controls);

    return row;
}

function createRoutineNoteDisplay(text, isStandalone = false) {
    const note = document.createElement('p');
    note.classList.add('routineNoteDisplay');
    if (isStandalone) {
        note.classList.add('routineStandaloneNote');
    }
    note.textContent = text;
    return note;
}

function createRoutineItemTitle(text) {
    const title = document.createElement('p');
    title.classList.add('routineItemTitle');
    title.textContent = text;
    return title;
}

function createRoutineTextarea(value, placeholder, disabled, onInput) {
    const textarea = document.createElement('textarea');
    textarea.maxLength = 1000;
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.disabled = disabled;
    textarea.addEventListener('input', event => onInput(event.target.value));
    return textarea;
}

function createRoutineIconButton(text, title, onClick, disabled = false, iconClasses = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('routineIconButton');
    button.title = title;
    button.setAttribute('aria-label', title);
    button.disabled = disabled;
    button.addEventListener('click', onClick);

    if (iconClasses) {
        const icon = document.createElement('i');
        icon.classList.add(...iconClasses);
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
    } else {
        button.textContent = text;
    }

    return button;
}

function handleRoutineTitleInput(event) {
    routineState.title = event.target.value.trim() || 'Untitled routine';
    scheduleRoutineSave();
}

function toggleRoutineViewMode() {
    if (!routineState.canEdit && routineState.viewMode) {
        return;
    }

    routineState.viewMode = !routineState.viewMode;
    setRoutineViewUrl(routineState.viewMode);
    renderRoutinePanel();
}

function updateRoutineViewModeClass() {
    document.body.classList.toggle('routineViewMode', routineState.viewMode);
}

function addDictionaryEntryToRoutine(data) {
    if (!routineState.canEdit || routineState.viewMode) {
        setRoutineStatus('This routine is view-only. Start a new routine to make changes.');
        return;
    }

    if (routineState.items.length >= maxRoutineItems) {
        setRoutineStatus(`Routines can have up to ${maxRoutineItems} items.`);
        return;
    }

    routineState.items.push({
        id: generateRandId(),
        type: 'entry',
        entryId: data.entryId,
        entryName: data.dictName,
        note: ''
    });

    renderRoutinePanel();
    showRoutineToast(`Added ${data.dictName || 'move'} to routine.`);
    scheduleRoutineSave();
}

function addRoutineNote() {
    if (!routineState.canEdit || routineState.viewMode) {
        return;
    }

    if (routineState.items.length >= maxRoutineItems) {
        setRoutineStatus(`Routines can have up to ${maxRoutineItems} items.`);
        return;
    }

    routineState.items.push({
        id: generateRandId(),
        type: 'note',
        text: ''
    });

    renderRoutinePanel();
    showRoutineToast('Added note to routine.');
    scheduleRoutineSave();
}

function removeRoutineItem(index) {
    if (!routineState.canEdit || routineState.viewMode) {
        return;
    }

    routineState.items.splice(index, 1);
    renderRoutinePanel();
    scheduleRoutineSave();
}

function moveRoutineItem(fromIndex, toIndex) {
    if (!routineState.canEdit || routineState.viewMode) {
        return;
    }

    if (toIndex < 0 || toIndex >= routineState.items.length || fromIndex === toIndex) {
        return;
    }

    const [item] = routineState.items.splice(fromIndex, 1);
    routineState.items.splice(toIndex, 0, item);
    renderRoutinePanel();
    scheduleRoutineSave();
}

function handleRoutineDragStart(event) {
    routineState.dragIndex = Number(event.currentTarget.dataset.index);
    event.currentTarget.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(routineState.dragIndex));
}

function handleRoutineDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    routineState.dragIndex = null;
}

function handleRoutineDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleRoutineDrop(event) {
    event.preventDefault();
    if (routineState.dragIndex === null) {
        return;
    }

    const toIndex = Number(event.currentTarget.dataset.index);
    moveRoutineItem(routineState.dragIndex, toIndex);
}

function handleRoutinePointerDragStart(event) {
    if (event.button !== undefined && event.button !== 0) {
        return;
    }

    const row = event.currentTarget.closest('.routineItem');
    if (!row || !routineState.canEdit || routineState.viewMode) {
        return;
    }

    event.preventDefault();
    routinePointerDrag = {
        fromIndex: Number(row.dataset.index),
        targetIndex: Number(row.dataset.index),
        handle: event.currentTarget
    };

    row.classList.add('dragging');
    row.classList.add('routineDropBefore');
    document.body.classList.add('routineDragging');

    if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    window.addEventListener('pointermove', handleRoutinePointerDragMove, { passive: false });
    window.addEventListener('pointerup', handleRoutinePointerDragEnd, { once: true });
    window.addEventListener('pointercancel', handleRoutinePointerDragCancel, { once: true });
}

function handleRoutinePointerDragMove(event) {
    if (!routinePointerDrag) {
        return;
    }

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetRow = target ? target.closest('.routineItem') : null;

    if (!targetRow || targetRow.dataset.index === undefined) {
        return;
    }

    const targetRect = targetRow.getBoundingClientRect();
    const targetIndex = Number(targetRow.dataset.index);
    const isAfterTarget = event.clientY > targetRect.top + (targetRect.height / 2);
    let insertionIndex = targetIndex + (isAfterTarget ? 1 : 0);

    document.querySelectorAll('.routineDropBefore, .routineDropAfter').forEach(row => {
        row.classList.remove('routineDropBefore', 'routineDropAfter');
    });

    targetRow.classList.add(isAfterTarget ? 'routineDropAfter' : 'routineDropBefore');

    if (insertionIndex > routinePointerDrag.fromIndex) {
        insertionIndex -= 1;
    }

    routinePointerDrag.targetIndex = Math.max(0, Math.min(insertionIndex, routineState.items.length - 1));
}

function handleRoutinePointerDragEnd(event) {
    if (!routinePointerDrag) {
        return;
    }

    event.preventDefault();
    const { fromIndex, targetIndex, handle } = routinePointerDrag;
    cleanupRoutinePointerDrag();

    if (handle && handle.releasePointerCapture) {
        try {
            handle.releasePointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture may already be released by the browser.
        }
    }

    moveRoutineItem(fromIndex, targetIndex);
}

function handleRoutinePointerDragCancel() {
    cleanupRoutinePointerDrag();
}

function cleanupRoutinePointerDrag() {
    document.body.classList.remove('routineDragging');
    document.querySelectorAll('.routineItem.dragging, .routineDropBefore, .routineDropAfter').forEach(row => {
        row.classList.remove('dragging', 'routineDropBefore', 'routineDropAfter');
    });
    window.removeEventListener('pointermove', handleRoutinePointerDragMove);
    window.removeEventListener('pointerup', handleRoutinePointerDragEnd);
    window.removeEventListener('pointercancel', handleRoutinePointerDragCancel);
    routinePointerDrag = null;
}

function findDictionaryEntry(entryId) {
    return localData.find(([id]) => id === entryId);
}

function startNewRoutine(clearUrl = true) {
    clearTimeout(routineState.saveTimer);
    routineState = {
        id: null,
        title: 'Untitled routine',
        ownerUid: null,
        ownerIsAnonymous: true,
        items: [],
        canEdit: true,
        viewMode: false,
        saveTimer: null,
        dragIndex: null
    };

    if (clearUrl) {
        setRoutineUrl(null);
        setRoutineViewUrl(false);
    }

    localStorage.removeItem(routineStorageKey);
    localStorage.removeItem(routineDraftStorageKey);
    document.getElementById('routine-share-box').hidden = true;
    renderRoutinePanel();
    setRoutineStatus('New routine started.');
}

async function deleteCurrentRoutine() {
    if (!routineState.id || !routineState.canEdit) {
        return;
    }

    await deleteRoutineById(routineState.id);
}

async function deleteRoutineById(routineId) {
    const confirmation = confirm('Delete this routine? This cannot be undone.');

    if (!confirmation) {
        return;
    }

    try {
        await db.collection(routineCollectionName).doc(routineId).delete();
        routineSummaries = routineSummaries.filter(routine => routine.id !== routineId);

        if (routineState.id === routineId) {
            startNewRoutine();
        } else {
            renderRoutineList(routineSummaries);
        }

        setRoutineLibraryStatus(routineSummaries.length ? '' : 'No saved routines yet.');
    } catch (error) {
        console.error('Error deleting routine:', error);
        setRoutineStatus('Unable to delete routine.');
    }
}

function scheduleRoutineSave() {
    if (!routineState.canEdit || routineState.viewMode) {
        return;
    }

    saveRoutineDraft();
    setRoutineStatus('Unsaved changes...');
    clearTimeout(routineState.saveTimer);
    routineState.saveTimer = setTimeout(() => {
        saveCurrentRoutine();
    }, routineSaveDelay);
}

async function saveCurrentRoutine() {
    if (!routineState.canEdit) {
        return false;
    }

    const isNewRoutine = !routineState.id;
    let attemptedRoutineId = null;

    try {
        setRoutineStatus('Saving...');
        const user = await getRoutineUser(true);

        if (!user) {
            setRoutineStatus(getRoutineAuthSetupMessage());
            return false;
        }

        if (isNewRoutine) {
            const docRef = db.collection(routineCollectionName).doc();
            attemptedRoutineId = docRef.id;
            routineState.id = docRef.id;
            routineState.ownerUid = user.uid;
            localStorage.setItem(routineStorageKey, routineState.id);
            setRoutineUrl(routineState.id);
        }

        const routineDoc = db.collection(routineCollectionName).doc(routineState.id);
        const ownerIsAnonymous = user.isAnonymous;
        const payload = {
            title: routineState.title || 'Untitled routine',
            ownerUid: routineState.ownerUid || user.uid,
            ownerIsAnonymous,
            items: sanitizeRoutineItems(routineState.items),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (isNewRoutine) {
            routineState.ownerUid = user.uid;
            routineState.ownerIsAnonymous = ownerIsAnonymous;
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            routineState.ownerIsAnonymous = ownerIsAnonymous;
            payload.expiresAt = firebase.firestore.FieldValue.delete();
        }

        await routineDoc.set(payload, { merge: true });
        localStorage.removeItem(routineDraftStorageKey);
        updateRoutineSummaryAfterSave();
        setRoutineStatus(ownerIsAnonymous ? 'Saved as a guest routine. Sign in to keep edit access permanently.' : 'Saved.');
        return true;
    } catch (error) {
        console.error('Error saving routine:', error);

        if (isNewRoutine && attemptedRoutineId && routineState.id === attemptedRoutineId) {
            routineState.id = null;
            routineState.ownerUid = null;
            localStorage.removeItem(routineStorageKey);
            setRoutineUrl(null);
        }

        setRoutineStatus(`Unable to save routine: ${getFriendlyFirestoreError(error)}`);
        return false;
    }
}

function getFriendlyFirestoreError(error) {
    if (error && error.code === 'permission-denied') {
        return 'permission denied. Refresh the page after publishing the latest rules and app files.';
    }

    return 'please try again.';
}

function updateRoutineSummaryAfterSave() {
    if (!routineState.id) {
        return;
    }

    const existingSummary = routineSummaries.find(routine => routine.id === routineState.id);
    const summary = {
        id: routineState.id,
        title: routineState.title || 'Untitled routine',
        itemCount: routineState.items.length,
        updatedAt: new Date(),
        ownerIsAnonymous: routineState.ownerIsAnonymous
    };

    if (existingSummary) {
        Object.assign(existingSummary, summary);
    } else {
        routineSummaries.unshift(summary);
    }

    routineSummaries.sort((a, b) => getRoutineTime(b.updatedAt) - getRoutineTime(a.updatedAt));
    renderRoutineList(routineSummaries);
}

function sanitizeRoutineItems(items) {
    return items.slice(0, maxRoutineItems).map(item => {
        if (item.type === 'note') {
            return {
                id: item.id || generateRandId(),
                type: 'note',
                text: String(item.text || '').slice(0, 1000)
            };
        }

        return {
            id: item.id || generateRandId(),
            type: 'entry',
            entryId: item.entryId || '',
            entryName: String(item.entryName || '').slice(0, 120),
            note: String(item.note || '').slice(0, 1000)
        };
    });
}

async function shareCurrentRoutine() {
    clearTimeout(routineState.saveTimer);

    if (routineState.canEdit) {
        const didSave = await saveCurrentRoutine();
        if (!didSave) {
            return;
        }
    }

    if (!routineState.id) {
        setRoutineStatus('Add something before sharing this routine.');
        return;
    }

    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set(routineIdParam, routineState.id);
    shareUrl.searchParams.set(routineViewParam, '1');

    const shareBox = document.getElementById('routine-share-box');
    const shareInput = document.getElementById('routine-share-link');
    shareInput.value = shareUrl.toString();
    shareBox.hidden = false;
    shareInput.select();

    try {
        await navigator.clipboard.writeText(shareInput.value);
        setRoutineStatus('Share link copied.');
    } catch (error) {
        setRoutineStatus('Share link ready.');
    }
}

function setRoutineStatus(message) {
    const status = document.getElementById('routine-status');
    if (status) {
        status.textContent = message;
    }
}

function setRoutineLibraryStatus(message) {
    const status = document.getElementById('routine-library-status');
    if (status) {
        status.textContent = message;
    }
}

function showRoutineToast(message) {
    let toast = document.getElementById('routine-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'routine-toast';
        toast.classList.add('routineToast');
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(routineToastTimer);
    routineToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2200);
}

async function getRoutineUser(createIfMissing) {
    let user = auth.currentUser || await waitForAuthReady();

    if (!user && createIfMissing) {
        try {
            lastRoutineAuthError = null;
            const credential = await auth.signInAnonymously();
            user = credential.user;
            syncRoutineAuthUi();
        } catch (error) {
            lastRoutineAuthError = error;
            console.error('Error signing in anonymously:', error);
        }
    }

    return user;
}

function getRoutineAuthSetupMessage() {
    if (!lastRoutineAuthError) {
        return 'Saving routines requires anonymous Firebase auth to be enabled.';
    }

    return `Routine sign-in failed: ${getFriendlyAuthError(lastRoutineAuthError)}`;
}

function getFriendlyAuthError(error) {
    if (!error) {
        return 'Unknown error.';
    }

    if (error.code === 'auth/operation-not-allowed') {
        return 'Enable the required sign-in provider in Firebase Authentication.';
    }

    if (error.code === 'auth/admin-restricted-operation') {
        return 'Enable account creation in Firebase Authentication settings. Guest routines and first-time Google sign-ins both create Auth users.';
    }

    if (error.code === 'auth/unauthorized-domain') {
        return 'Add this website domain to Firebase Authentication authorized domains.';
    }

    if (error.code === 'auth/popup-closed-by-user') {
        return 'The sign-in window was closed before finishing.';
    }

    return error.message || error.code || 'Unknown error.';
}

function waitForAuthReady() {
    return new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });
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
