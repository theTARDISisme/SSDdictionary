// Import the necessary objects from firebaseConfig.js
import { db } from "./firebaseConfig";


// app.js or app.ts
function addDefinition() {
    const moveName = document.getElementById('moveName').value;
    const moveDescription = document.getElementById('moveDescription').value;
    const gifUrl = document.getElementById('gifUrl').value;

    db.collection('moves').doc(moveName).set({
        name: moveName,
        description: moveDescription,
        gifUrl: gifUrl,
    })
        .then(() => {
            console.log(`Definition for ${moveName} added to the database.`);
            // Optionally, you can clear the form after adding the definition
            document.getElementById('addDefinitionForm').reset();
        })
        .catch((error) => {
            console.error(`Error adding definition: ${error}`);
        });
}
