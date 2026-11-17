import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, fbSignOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
});

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  return mobileUserAgent || Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);
}

function describeGoogleAuthError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code) : '';
  if (code === 'auth/unauthorized-domain') {
    return 'Google Sign-In is not enabled for this website domain. Add the current AutoSocial domain to Firebase Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/invalid-action-code' || code === 'auth/invalid-continue-uri') {
    return 'Firebase rejected the Google Sign-In redirect URL. Verify the Firebase authDomain and authorized redirect configuration.';
  }
  if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
    return 'The Google Sign-In popup was blocked or closed. Try again, or allow popups for AutoSocial AI.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Google Sign-In could not reach Firebase. Check the network connection and try again.';
  }
  return error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        await getRedirectResult(auth);
      } catch (error) {
        if (!cancelled) {
          console.error('Google redirect sign-in failed:', error);
        }
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const initialProfile: UserProfile = {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Instagram Creator',
              photoURL: currentUser.photoURL || '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              autoPublishApproved: false,
              theme: 'dark',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
          }
        } catch (error) {
          console.error('Error fetching/setting user profile:', error);
          try {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          } catch {
            // Logged via handleFirestoreError
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      console.error('Google Sign In failed:', err);
      throw new Error(describeGoogleAuthError(err));
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const payload = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userDocRef, payload);
      setUserProfile((prev) => (prev ? { ...prev, ...payload } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
