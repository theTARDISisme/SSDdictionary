// Import the functions you need from the Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.esm.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics.esm.js';
import 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.esm.js';

// Your web app's Firebase configuration
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

const db = app.firestore();

// Export the necessary objects
export { app, analytics, db };


