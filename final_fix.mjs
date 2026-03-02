import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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

async function recalculate() {
  console.log("Starting final data reconciliation...");
  
  const playersSnap = await getDocs(collection(db, "players"));
  const players = {};
  playersSnap.docs.forEach(d => {
    players[d.id] = { points: 0, goalsFor: 0, goalsAgainst: 0 };
  });

  const matchesSnap = await getDocs(collection(db, "matches"));
  matchesSnap.docs.forEach(d => {
    const m = d.data();
    if (m.status !== "approved" || m.stage !== "groups") return;
    
    const p1 = m.player1Id, p2 = m.player2Id;
    const s1 = Number(m.score1 ?? 0), s2 = Number(m.score2 ?? 0);
    
    if (players[p1]) {
      players[p1].goalsFor += s1;
      players[p1].goalsAgainst += s2;
      if (s1 > s2) players[p1].points += 3;
      else if (s1 === s2) players[p1].points += 1;
    }
    if (players[p2]) {
      players[p2].goalsFor += s2;
      players[p2].goalsAgainst += s1;
      if (s2 > s1) players[p2].points += 3;
      else if (s2 === s1) players[p2].points += 1;
    }
  });

  for (const pid in players) {
    await updateDoc(doc(db, "players", pid), players[pid]);
  }
  console.log("Data reconciliation complete.");
}

recalculate().catch(console.error);
