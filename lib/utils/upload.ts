'use client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadImage(file: File, folder: string): Promise<string> {
  try {
    if (!storage) {
      throw new Error("Firebase Storage is not initialized. Please verify your environment configuration.");
    }

    if (!file) {
      throw new Error("No image file provided for upload.");
    }

    // Security: Validate image MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error("Invalid file format. Please upload a valid image (JPEG, PNG, WebP, or GIF).");
    }

    // Security: Enforce strict file size cap
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("File exceeds 5MB limit. Please upload a smaller image.");
    }
    
    // Security: Sanitize filename and prevent directory traversal
    const safeBase = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${safeBase}`;
    const storageRef = ref(storage, `${folder}/${filename}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    
    // Retrieve download URL
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (error: any) {
    console.error("Firebase Storage Upload Error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
}
