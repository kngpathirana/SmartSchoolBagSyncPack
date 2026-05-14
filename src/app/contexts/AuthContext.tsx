import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { ref, set, update, get } from 'firebase/database';
import { auth, db } from '../../lib/firebase';

interface AuthContextType {
  user:        User | null;
  loading:     boolean;
  displayName: string;
  photoURL:    string | null;
  phone:       string;
  login:              (email: string, password: string) => Promise<void>;
  register:           (name: string, email: string, password: string) => Promise<void>;
  logout:             () => Promise<void>;
  updateUserProfile:  (fields: { displayName?: string; photoURL?: string; phone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [photoURL,    setPhotoURL]    = useState<string | null>(null);
  const [phone,       setPhone]       = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Load extra profile fields (photo, phone) from Realtime DB
        try {
          const snap = await get(ref(db, `users/${u.uid}`));
          const data = snap.val() ?? {};
          setDisplayName(data.displayName ?? data.name ?? u.displayName ?? '');
          setPhotoURL(data.photoURL ?? u.photoURL ?? null);
          setPhone(data.phone ?? '');
        } catch {
          setDisplayName(u.displayName ?? '');
          setPhotoURL(u.photoURL ?? null);
          setPhone('');
        }
      } else {
        setDisplayName('');
        setPhotoURL(null);
        setPhone('');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    try {
      await set(ref(db, `users/${cred.user.uid}`), {
        displayName: name,
        email,
        createdAt: Date.now(),
      });
    } catch {
      // non-fatal — auth account created, DB profile save failed
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUserProfile = async (fields: { displayName?: string; photoURL?: string; phone?: string }) => {
    if (!auth.currentUser) return;

    // Update Firebase Auth displayName (not photoURL — data URIs aren't valid there)
    if (fields.displayName) {
      await updateProfile(auth.currentUser, { displayName: fields.displayName });
    }

    // Write everything to Realtime DB
    const dbFields: Record<string, string> = {};
    if (fields.displayName) dbFields.displayName = fields.displayName;
    if (fields.photoURL)    dbFields.photoURL    = fields.photoURL;
    if (fields.phone)       dbFields.phone       = fields.phone;

    if (Object.keys(dbFields).length > 0) {
      await update(ref(db, `users/${auth.currentUser.uid}`), dbFields);
    }

    // Update local state immediately — no need to wait for Firebase
    if (fields.displayName !== undefined) setDisplayName(fields.displayName);
    if (fields.photoURL    !== undefined) setPhotoURL(fields.photoURL);
    if (fields.phone       !== undefined) setPhone(fields.phone);
  };

  return (
    <AuthContext.Provider value={{ user, loading, displayName, photoURL, phone, login, register, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
