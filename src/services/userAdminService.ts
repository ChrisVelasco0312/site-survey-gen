import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase-config';
import { UserProfile, UserRole, GroupAssignment } from '../types/User';

export const getUsers = async (): Promise<UserProfile[]> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const createUser = async (
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  groupAssignment: GroupAssignment
): Promise<void> => {
  // Use a secondary app to create the auth user so we don't log out the current admin user
  const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUid = userCredential.user.uid;

    // 2. Sign out of secondary auth so it doesn't persist
    await signOut(secondaryAuth);

    // 3. Create user document in Firestore using main db instance
    const userDocRef = doc(db, 'users', newUid);
    const newUserData = {
      uid: newUid,
      email: email,
      full_name: fullName,
      role: role,
      group_assignment: role === 'field_worker' ? groupAssignment : 'all',
      is_active: true,
      created_at: serverTimestamp(),
      last_login: serverTimestamp()
    };
    
    await setDoc(userDocRef, newUserData);

  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};
