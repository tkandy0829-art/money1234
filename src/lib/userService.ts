import { supabase } from './supabase';

export interface UserRecord {
  id: string;
  password?: string;
  balance: number;
}

export const checkIdExists = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .single();
  
  return !!data;
};

export const registerUser = async (user: UserRecord): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .insert([
      { id: user.id, password: user.password, balance: user.balance }
    ]);
  
  if (error) throw error;
};

export const loginUser = async (id: string, password: string): Promise<UserRecord | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .eq('password', password)
    .single();
  
  if (error || !data) return null;
  return data as UserRecord;
};

export const getAllUsers = async (): Promise<UserRecord[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*');
  
  if (error) return [];
  return data as UserRecord[];
};

export const updateUserBalanceInFirestore = async (userId: string, newBalance: number): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ balance: newBalance })
    .eq('id', userId);
  
  if (error) throw error;
};
