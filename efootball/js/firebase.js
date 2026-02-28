import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyReplaceThisWithYourOwn",
    authDomain: "efootball-tourney.firebaseapp.com",
    projectId: "efootball-tourney",
    storageBucket: "efootball-tourney.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
