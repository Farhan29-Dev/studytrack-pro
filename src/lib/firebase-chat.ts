import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from './firebase';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types';

// Type for message with optional image
export interface ChatMessageWithImage extends ChatMessage {
  image_url?: string;
}

// Determine which backend to use
const useFirebase = isFirebaseConfigured();

// ============================================
// CHAT MESSAGE OPERATIONS
// ============================================

export const fetchChatMessages = async (userId: string): Promise<ChatMessageWithImage[]> => {
  if (useFirebase && db) {
    try {
      const messagesRef = collection(db, 'chat_messages');
      const q = query(
        messagesRef,
        where('user_id', '==', userId),
        orderBy('created_at', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as ChatMessageWithImage[];
    } catch (error) {
      console.error('Firebase fetch error:', error);
      throw error;
    }
  }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as ChatMessageWithImage[]) || [];
};

export const saveChatMessage = async (
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  imageUrl?: string
): Promise<ChatMessageWithImage> => {
  if (useFirebase && db) {
    try {
      const messagesRef = collection(db, 'chat_messages');
      const docData: any = {
        user_id: userId,
        role,
        content,
        created_at: Timestamp.now(),
      };
      if (imageUrl) {
        docData.image_url = imageUrl;
      }
      const docRef = await addDoc(messagesRef, docData);
      return {
        id: docRef.id,
        user_id: userId,
        role,
        content,
        created_at: new Date().toISOString(),
        image_url: imageUrl,
      };
    } catch (error) {
      console.error('Firebase save error:', error);
      throw error;
    }
  }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessageWithImage;
};

export const clearChatMessages = async (userId: string): Promise<void> => {
  if (useFirebase && db) {
    try {
      const messagesRef = collection(db, 'chat_messages');
      const q = query(messagesRef, where('user_id', '==', userId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((docSnapshot) =>
        deleteDoc(doc(db, 'chat_messages', docSnapshot.id))
      );
      await Promise.all(deletePromises);
      return;
    } catch (error) {
      console.error('Firebase delete error:', error);
      throw error;
    }
  }

  // Fallback to Supabase
  const { error } = await supabase.from('chat_messages').delete().eq('user_id', userId);
  if (error) throw error;
};

// ============================================
// IMAGE UPLOAD OPERATIONS
// ============================================

export const uploadChatImage = async (
  userId: string,
  file: File
): Promise<string> => {
  if (useFirebase && storage) {
    try {
      const fileName = `${userId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `chat-images/${fileName}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw error;
    }
  }

  // Convert to base64 as fallback (stored temporarily, not in database)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Get backend status
export const getBackendStatus = () => ({
  usingFirebase: useFirebase,
  configured: useFirebase || true, // Supabase is always configured
});
