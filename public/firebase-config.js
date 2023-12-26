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
console.log(firebase);
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
