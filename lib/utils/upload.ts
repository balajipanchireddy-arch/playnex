'use client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';

export async function uploadImage(file: File, folder: string): Promise<string> {
  try {
    if (!storage) throw new Error("Firebase Storage is not initialized. Check your config.");
    
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const storageRef = ref(storage, `${folder}/${filename}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the URL
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (error: any) {
    console.error("🔥 FIREBASE UPLOAD ERROR:", error);
    throw new Error(error.message || "Failed to upload image");
  }
}
