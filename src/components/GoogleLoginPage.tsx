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
      <div className="login-loading"><span className="login-spinner" />불러오는 중...</div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-panel-bar">◆ <span>Powered by cal.dudu</span></div>
        <div className="login-columns">
          <section className="login-intro">
            <div className="login-avatar" aria-hidden="true">d</div>
            <span className="eyebrow">cal.dudu</span>
            <h1>예약 상담</h1>
            <p>가능한 시간을 선택하고 운영자 확인을 거쳐 상담 예약을 완료하세요.</p>
            <div className="login-detail"><span aria-hidden="true">◷</span>30분 상담</div>
            <div className="login-detail"><span aria-hidden="true">◎</span>Asia / Seoul</div>
            <div className="login-intro-footer">간단한 로그인 후 예약 가능한 시간을 확인할 수 있습니다.</div>
          </section>

          <section className="login-form-panel">
            <div className="login-form-heading">
              <span className="eyebrow">Welcome</span>
              <h2>로그인하여 예약하기</h2>
              <p>예약 신청과 확정 상태를 안전하게 확인합니다.</p>
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
      <p className="login-footer">cal.dudu-works.com · 예약 관리</p>
    </div>
  );
};
