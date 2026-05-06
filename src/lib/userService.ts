import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserRecord {
  id: string;
  password?: string;
  balance: number;
}

export const checkIdExists = async (id: string): Promise<boolean> => {
  const docRef = doc(db, 'users', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
};

export const registerUser = async (user: UserRecord): Promise<void> => {
  await setDoc(doc(db, 'users', user.id), user);
};

export const loginUser = async (id: string, password: string): Promise<UserRecord | null> => {
  const docRef = doc(db, 'users', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data() as UserRecord;
    if (data.password === password) {
      return data;
    }
  }
  return null;
};

export const getAllUsers = async (): Promise<UserRecord[]> => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => doc.data() as UserRecord);
};

export const updateUserBalanceInFirestore = async (userId: string, newBalance: number): Promise<void> => {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, { balance: newBalance });
};
