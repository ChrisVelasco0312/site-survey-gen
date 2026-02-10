import { createContext, ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase-config';
import { saveUserToDB, getUserFromDB } from '../../utils/indexedDB';
import { UserProfile } from '../../types/User';

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ComponentChildren;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function signup(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Try to get from Firestore first (online)
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            // Ensure uid is present
            const profileData: UserProfile = { ...data, uid: currentUser.uid };
            console.log("User Data Fetched from Firestore:", profileData);
            setUserData(profileData);
            // Save to IndexedDB for offline use
            await saveUserToDB(profileData);
          } else {
            console.error("No such user document!");
            setUserData(null);
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore, trying offline cache:", error);
          // Fallback to IndexedDB (offline)
          try {
            const cachedUser = await getUserFromDB(currentUser.uid);
            if (cachedUser) {
              console.log("User Data Fetched from IndexedDB:", cachedUser);
              setUserData(cachedUser);
            } else {
               console.warn("No user data found in offline cache.");
               setUserData(null);
            }
          } catch (dbError) {
             console.error("Error fetching from IndexedDB:", dbError);
             setUserData(null);
          }
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    userData,
    login,
    signup,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
