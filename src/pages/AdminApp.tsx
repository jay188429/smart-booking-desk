import React, { useState, useEffect } from 'react';
import { SupabaseAdminPage } from '../components/SupabaseAdminPage';
import { supabase, signOut } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminAppProps {
  user: User;
  onLogout: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ user, onLogout }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      onLogout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time">
            기준 시각: {now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 현재 시각)
            <br />
            <span style={{ fontSize: '12px', color: '#666' }}>로그인: {user.email} (관리자)</span>
          </div>
        </div>
        <div className="role-selector">
          <button
            className="btn logout-button"
            onClick={handleLogout}
            style={{ padding: '6px 12px', fontSize: '12px', marginLeft: '10px' }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="alert alert-warning">
        <strong>관리자 화면:</strong> 신청 확인, 수동 확정, 실행 기록
      </div>

      <SupabaseAdminPage client={supabase} user={user} />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 관리자 화면</p>
        <p><a href="/customer">고객 화면으로 이동</a></p>
      </div>
    </div>
  );
};
