import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';

export const schoolCollection = (schoolId, name) => collection(db, 'schools', schoolId, name);

export function watchCollection(schoolId, name, setData, sortField = 'createdAt') {
  const ref = schoolCollection(schoolId, name);
  const q = query(ref, orderBy(sortField, 'desc'));
  return onSnapshot(q, (snapshot) => {
    setData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  });
}

export function createRecord(schoolId, name, data) {
  return addDoc(schoolCollection(schoolId, name), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function updateRecord(schoolId, name, id, data) {
  return updateDoc(doc(db, 'schools', schoolId, name, id), { ...data, updatedAt: serverTimestamp() });
}

export function deleteRecord(schoolId, name, id) {
  return deleteDoc(doc(db, 'schools', schoolId, name, id));
}

export function listenSchool(schoolId, setSchool) {
  return onSnapshot(doc(db, 'schools', schoolId), (snapshot) => {
    if (snapshot.exists()) setSchool({ id: snapshot.id, ...snapshot.data() });
  });
}

export async function createSchoolForUser(uid, schoolName) {
  const schoolRef = await addDoc(collection(db, 'schools'), {
    name: schoolName.trim(),
    ownerId: uid,
    currency: 'KES',
    mpesaShortCode: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', uid), { schoolId: schoolRef.id, updatedAt: serverTimestamp() });
  return schoolRef.id;
}
