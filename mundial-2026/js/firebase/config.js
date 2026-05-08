// js/firebase/config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// ── CONFIG FIREBASE ──
const firebaseConfig = {
  apiKey:            "AIzaSyBkOqWfEpPNDun1jHJNV0g1creQAUCdgMo",
  authDomain:        "quiniela-mundialista-202-bff2f.firebaseapp.com",
  projectId:         "quiniela-mundialista-202-bff2f",
  storageBucket:     "quiniela-mundialista-202-bff2f.firebasestorage.app",
  messagingSenderId: "366645558738",
  appId:             "1:366645558738:web:82c13047ea5151f6f2dc0b"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);