import React from 'react';
import { SupabaseCustomerPage } from '../components/SupabaseCustomerPage';
import { WeatherStatus } from '../components/WeatherStatus';
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
    <div className="container customer-route">
      <div className="header">
        <div>
          <h1>Smart Booking Desk</h1>
          <div className="welcome-message">
            <strong>{user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '고객'}님 안녕하세요</strong>
            <span>오늘 하루는 어떠신가요?</span>
            <WeatherStatus />
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

      <SupabaseCustomerPage client={supabase} user={user} />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>Smart Booking Desk v1.0 - 고객 화면</p>
        {userRole === 'admin' && (
          <p><a href="/admin">Admin</a></p>
        )}
      </div>
    </div>
  );
};
