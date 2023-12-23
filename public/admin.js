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
            transaction.update(entryRef, { dictIndex: firebase.firestore.FieldValue.increment(-1) });
        });

        if (!lowerEntrySnapshot.empty) {
            const lowerEntryRef = lowerEntrySnapshot.docs[0].ref;

            // Update the lower entry's index
            await db.runTransaction(async (transaction) => {
                transaction.update(lowerEntryRef, { dictIndex: firebase.firestore.FieldValue.increment(1) });
            });
        }

        console.log('Entry moved up successfully.');
        // Refresh the displayed entries after the move
        fetchData('', 'all');
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
            transaction.update(entryRef, { dictIndex: firebase.firestore.FieldValue.increment(1) });
        });

        if (!higherEntrySnapshot.empty) {
            const higherEntryRef = higherEntrySnapshot.docs[0].ref;

            // Update the higher entry's index
            await db.runTransaction(async (transaction) => {
                transaction.update(higherEntryRef, { dictIndex: firebase.firestore.FieldValue.increment(-1) });
            });
        }

        console.log('Entry moved down successfully.');
        // Refresh the displayed entries after the move
        fetchData('', 'all');
    } catch (error) {
        console.error('Error moving entry down:', error);
    }
}





