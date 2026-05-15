import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBuPjAxOYKNdWl6OrTLW1gKnkadX4Ly-xE",
  authDomain: "smart-school-bag-tracker.firebaseapp.com",
  databaseURL: "https://smart-school-bag-tracker-default-rtdb.firebaseio.com",
  projectId: "smart-school-bag-tracker",
  storageBucket: "smart-school-bag-tracker.firebasestorage.app",
  messagingSenderId: "542327984884",
  appId: "1:542327984884:web:43c45b1d39132676a544a1"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);