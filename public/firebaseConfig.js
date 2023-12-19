// Import the functions you need from the Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.esm.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics.esm.js';
import 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.esm.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    // Your Firebase configuration here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = app.firestore();

// Export the necessary objects
export { app, analytics, db };
