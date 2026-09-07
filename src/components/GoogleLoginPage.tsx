import React, { useState, useEffect, useRef } from 'react';
import { signInWithGoogle, getCurrentUser } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface GoogleLoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const GoogleLoginPage: React.FC<GoogleLoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const hasCalledSuccess = useRef(false);

  // 페이지 로드 시 현재 사용자 확인
  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        console.log('GoogleLoginPage - 사용자 확인:', currentUser?.email);
        if (currentUser && !hasCalledSuccess.current) {
          hasCalledSuccess.current = true;
          console.log('GoogleLoginPage - onLoginSuccess 호출');
          onLoginSuccess(currentUser);
        }
      } catch (err) {
        console.error('사용자 확인 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Google 로그인 시작');
      await signInWithGoogle();
    } catch (err) {
      console.error('Google 로그인 오류:', err);
      setError(err instanceof Error ? err.message : 'Google 로그인 실패');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center', padding: '20px' }}>
      <h1>cal.dudu-works.com</h1>
      <h2>Google로 로그인</h2>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <strong>오류:</strong> {error}
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          backgroundColor: '#4285F4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '로그인 중...' : 'Google로 계속'}
      </button>

      <p style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        Google 계정으로 로그인하면 예약 시스템에 접속할 수 있습니다.
        <br />
        관리자: you18676@gmail.com
      </p>
    </div>
  );
};
