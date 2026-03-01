import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// User Provided Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDy_ZCcsXGU7su6xHJY54OtuLcXOB8sZNs",
    authDomain: "pesef-43609.firebaseapp.com",
    projectId: "pesef-43609",
    storageBucket: "pesef-43609.firebasestorage.app",
    messagingSenderId: "11775033418",
    appId: "1:11775033418:web:9534cffaf99a085e07e6b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
