import React from 'react';
import { SupabaseCustomerPage } from '../components/SupabaseCustomerPage';
import { supabase, signOut } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface CustomerAppProps {
  user: User;
  userRole: string | null;
  onLogout: () => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({ user, userRole, onLogout }) => {
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
          <div className="welcome-message">
            <strong>{user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '고객'}님 안녕하세요</strong>
            <span>오늘 하루는 어떠신가요?</span>
            <span>날씨가 참 좋네요.</span>
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

      <div className="alert alert-info">
        <strong>고객 화면:</strong> 예약 신청, 상태 확인, 재선택
      </div>

      <SupabaseCustomerPage client={supabase} user={user} />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 고객 화면</p>
        {userRole === 'admin' && (
          <p><a href="/admin">어드민 화면으로 이동</a></p>
        )}
      </div>
    </div>
  );
};
