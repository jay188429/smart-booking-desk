import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_EMAILS = new Set(['you18676@gmail.com']);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`,
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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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

  // Supabase에서 user_metadata와 app_metadata 모두 확인
  const userMetadata = (user as any).user_metadata || {};
  const appMetadata = (user as any).app_metadata || {};

  console.log('getUserRole - email:', user.email);
  console.log('getUserRole - app_metadata:', appMetadata);
  console.log('getUserRole - user_metadata:', userMetadata);

  // 요청된 관리자 계정은 UI 진입점을 제공하되, 실제 RPC 권한은 DB가 다시 검증합니다.
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
    console.log('관리자 이메일 확인');
    return 'admin';
  }

  if (appMetadata.role) {
    console.log('역할 발견 (app_metadata):', appMetadata.role);
    return appMetadata.role;
  }

  console.log('역할 없음');
  return null;
}
