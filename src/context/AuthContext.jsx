import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

async function ensureUserProfile(user, overrides = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: 'admin',
      schoolId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    });
  }
  const fresh = await getDoc(ref);
  return fresh.data();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    try {
      setUser(nextUser);
      setProfile(nextUser ? await ensureUserProfile(nextUser) : null);
    } finally {
      setLoading(false);
    }
  }), []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    async register({ name, email, password }) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name?.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      const nextProfile = await ensureUserProfile(credential.user, { displayName: name?.trim() || '' });
      setProfile(nextProfile);
      return credential.user;
    },
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInGoogle: () => signInWithPopup(auth, googleProvider),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth),
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
