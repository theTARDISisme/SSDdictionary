// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Function to fetch data from Firestore
function fetchData() {
    db.collection("moves").onSnapshot((snapshot) => {
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = ""; // Clear previous results

        snapshot.forEach((doc) => {
            const moveData = doc.data();
            const moveElement = document.createElement("div");
            moveElement.innerHTML = `<h3>${moveData.name}</h3>
                                   <p>${moveData.description}</p>
                                   <img src="${moveData.gifUrl}" alt="${moveData.name}">`;
            resultsDiv.appendChild(moveElement);
        });
    });
}

// Trigger fetchData on page load
window.onload = fetchData;

// Function to handle user authentication
function signIn() {
    // Use Firebase authentication methods here
    // For example, you can use Google authentication
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log(`Signed in as ${user.displayName}`);
        })
        .catch((error) => {
            console.error(error.message);
        });
}

// Function to add or edit entries (requires user authentication)
function addOrEditEntry(moveName, moveDescription, gifUrl) {
    const user = auth.currentUser;

    if (user) {
        db.collection("moves").doc(moveName).set({
            name: moveName,
            description: moveDescription,
            gifUrl: gifUrl,
        }, { merge: true })
            .then(() => {
                console.log(`Entry ${moveName} successfully added/edited`);
            })
            .catch((error) => {
                console.error(`Error adding/editing entry: ${error}`);
            });
    } else {
        console.error("User not authenticated");
    }
}

// Function to handle search as you type
document.getElementById("searchInput").addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();

    db.collection("moves").where("name", ">=", searchTerm).where("name", "<=", searchTerm + "\uf8ff")
        .onSnapshot((snapshot) => {
            const resultsDiv = document.getElementById("results");
            resultsDiv.innerHTML = ""; // Clear previous results

            snapshot.forEach((doc) => {
                const moveData = doc.data();
                const moveElement = document.createElement("div");
                moveElement.innerHTML = `<h3>${moveData.name}</h3>
                                       <p>${moveData.description}</p>
                                       <img src="${moveData.gifUrl}" alt="${moveData.name}">`;
                resultsDiv.appendChild(moveElement);
            });
        });
});
