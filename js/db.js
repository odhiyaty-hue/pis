import { db } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Collection References
const playersColl = collection(db, "players");
const groupsColl = collection(db, "groups");
const matchesColl = collection(db, "matches");

export const DB = {
    // ---- Players ----
    async addPlayer(playerData) {
        return await addDoc(playersColl, {
            ...playerData,
            status: "pending",
            group: null,
            points: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            eliminated: false,
            createdAt: new Date()
        });
    },

    async checkGameNameExists(gameName) {
        const q = query(playersColl, where("gameName", "==", gameName));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    },

    async getAllPlayers() {
        const querySnapshot = await getDocs(query(playersColl, orderBy("createdAt", "desc")));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getApprovedPlayers() {
        const q = query(playersColl, where("status", "==", "approved"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async updatePlayerStatus(playerId, status) {
        const playerRef = doc(db, "players", playerId);
        return await updateDoc(playerRef, { status });
    },

    async updatePlayerStats(playerId, points, gf, ga) {
        const playerRef = doc(db, "players", playerId);
        const playerDoc = await getDoc(playerRef);
        if (playerDoc.exists()) {
            const data = playerDoc.data();
            return await updateDoc(playerRef, {
                points: (data.points || 0) + points,
                goalsFor: (data.goalsFor || 0) + gf,
                goalsAgainst: (data.goalsAgainst || 0) + ga
            });
        }
    },

    // ---- Groups ----
    async createGroup(groupName, players) {
        return await addDoc(groupsColl, {
            name: groupName,
            players: players.map(p => p.id), // Array of IDs
            createdAt: new Date()
        });
    },

    async assignPlayerToGroup(playerId, groupName) {
        const playerRef = doc(db, "players", playerId);
        return await updateDoc(playerRef, { group: groupName });
    },

    async getGroups() {
        const querySnapshot = await getDocs(groupsColl);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ---- Matches ----
    async createMatch(matchData) {
        return await addDoc(matchesColl, {
            ...matchData,
            score1: null,
            score2: null,
            winnerId: null,
            screenshotUrl: null,
            status: "pending_result", // pending_result, pending_approval, approved
            stage: matchData.stage || "groups", // groups or knockout
            createdAt: new Date()
        });
    },

    async getMatchesByStage(stage) {
        const q = query(matchesColl, where("stage", "==", stage));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getMatchesByGroup(groupName) {
        const q = query(matchesColl, where("group", "==", groupName));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async updateMatchResult(matchId, resultData) {
        const matchRef = doc(db, "matches", matchId);
        return await updateDoc(matchRef, resultData);
    }
};
