import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Google 로그인 실패:', error.message);
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('로그아웃 실패:', error.message);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const promise = supabase.auth.getUser();

    // 5초 타임아웃
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('사용자 조회 타임아웃')), 5000)
    );

    const {
      data: { user },
      error,
    } = await Promise.race([promise, timeoutPromise]) as any;

    if (error) {
      console.error('사용자 조회 실패:', error.message);
      return null;
    }

    return user;
  } catch (err) {
    console.error('사용자 조회 중 오류:', err);
    return null;
  }
}

export async function getUserRole() {
  const user = await getCurrentUser();
  if (!user) return null;

  const appMetadata = (user as any).app_metadata || {};

  return appMetadata.role || null;
}
