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
  const currentSeoulTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

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
      <div className="login-loading"><span className="login-spinner" />불러오는 중...</div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-panel-bar">◆ <span>Powered by Smart Booking Desk</span></div>
        <div className="login-columns">
          <section className="login-intro">
            <div className="login-avatar" aria-hidden="true">d</div>
            <span className="eyebrow">Smart Booking Desk</span>
            <h1>예약하기</h1>
            <p>원하는 시간을 선택해 주세요.</p>
            <div className="login-detail"><span aria-hidden="true">◷</span>1시간 이용</div>
            <div className="login-detail"><span aria-hidden="true">◷</span>현재 시각 {currentSeoulTime} (KST)</div>
            <div className="login-intro-footer">로그인 후 예약할 수 있습니다.</div>
          </section>

          <section className="login-form-panel">
            <div className="login-form-heading">
              <span className="eyebrow">Welcome</span>
              <h2>예약하기</h2>
              <p>로그인 후 예약을 진행하세요.</p>
            </div>
            {error && (
              <div className="alert alert-error login-error">
                <strong>로그인 오류</strong><br />{error}
              </div>
            )}
            <button className="google-login-button" onClick={handleGoogleLogin} disabled={loading}>
              <span className="google-mark" aria-hidden="true">G</span>
              {loading ? '로그인 중...' : 'Google로 계속'}
            </button>
            <p className="login-legal">로그인하면 예약 시스템 이용에 동의한 것으로 간주됩니다.</p>
          </section>
        </div>
      </div>
      <p className="login-footer">Smart Booking Desk · 예약 관리</p>
    </div>
  );
};
