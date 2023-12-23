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

        // Get the current entry's index
        const currentEntry = await entryRef.get();
        const currentEntryIndex = currentEntry.data().dictIndex;

        if (currentEntryIndex === 0) {
            // Entry is already at the top, no need to move up
            console.log('Entry is already at the top.');
            return;
        }

        // Update the current entry and the lower entry in a transaction
        await db.runTransaction(async (transaction) => {
            transaction.update(entryRef, { dictIndex: firebase.firestore.FieldValue.increment(-1) });

            // Find and update the lower entry
            const lowerEntrySnapshot = await db.collection('dictionary').where('dictIndex', '==', currentEntryIndex - 1).limit(1).get();

            if (!lowerEntrySnapshot.empty) {
                const lowerEntryRef = lowerEntrySnapshot.docs[0].ref;
                transaction.update(lowerEntryRef, { dictIndex: firebase.firestore.FieldValue.increment(1) });
            }
        });

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

        // Get the current entry's index
        const currentEntry = await entryRef.get();
        const currentEntryIndex = currentEntry.data().dictIndex;

        // Find and update the lower entry
        const lowerEntrySnapshot = await db.collection('dictionary').where('dictIndex', '==', currentEntryIndex + 1).limit(1).get();

        if (lowerEntrySnapshot.empty) {
            // Entry is already at the bottom, no need to move down
            console.log('Entry is already at the bottom.');
            return;
        }

        // Update the current entry and the lower entry in a transaction
        await db.runTransaction(async (transaction) => {
            transaction.update(entryRef, { dictIndex: firebase.firestore.FieldValue.increment(1) });

            const lowerEntryRef = lowerEntrySnapshot.docs[0].ref;
            transaction.update(lowerEntryRef, { dictIndex: firebase.firestore.FieldValue.increment(-1) });
        });

        console.log('Entry moved down successfully.');
        // Refresh the displayed entries after the move
        fetchData('', 'all');
    } catch (error) {
        console.error('Error moving entry down:', error);
    }
}






