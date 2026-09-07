import React, { useState, useEffect } from 'react';
import { CustomerPage } from '../components/CustomerPage';
import { DatabaseManager } from '../utils/database';
import { supabase, signOut } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface CustomerAppProps {
  user: User;
  userRole: string | null;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({ user, userRole }) => {
  const [now, setNow] = useState(() => new Date());
  const [db] = useState(() => new DatabaseManager());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
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
            <span style={{ fontSize: '12px', color: '#666' }}>로그인: {user.email}</span>
          </div>
        </div>
        <div className="role-selector">
          <button
            className="btn btn-secondary"
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

      <CustomerPage db={db} mode="supabase" />

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
