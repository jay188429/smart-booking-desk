import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleLoginPage } from '../components/GoogleLoginPage';
import { CustomerApp } from './CustomerApp';
import { AdminApp } from './AdminApp';
import { LocalDemoApp } from './LocalDemoApp';
import { getCurrentUser, getUserRole, signOut } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const localDemo = import.meta.env.VITE_APP_MODE === 'local';

  // 초기화: 로그인된 사용자 확인
  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await getCurrentUser();
        console.log('[App] 초기화 - 현재 사용자:', currentUser?.email);

        if (currentUser) {
          setUser(currentUser);
          const role = await getUserRole();
          console.log('[App] 초기화 - 역할:', role);
          setUserRole(role);
        }
      } catch (err) {
        console.error('[App] 초기화 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [localDemo]);

  const handleLogout = async () => {
    console.log('[App] 로그아웃');
    await signOut();
    setUser(null);
    setUserRole(null);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <GoogleLoginPage
        onLoginSuccess={async (newUser) => {
          console.log('[App] 로그인 성공:', newUser.email);
          const role = await getUserRole();
          console.log('[App] 로그인 후 역할:', role);

          setUser(newUser);
          setUserRole(role);
        }}
      />
    );
  }

  if (localDemo) return <LocalDemoApp user={user} onLogout={() => void handleLogout()} />;

  console.log('[App] 렌더링:', {
    pathname: location.pathname,
    userRole,
    isAdminRoute: location.pathname === '/admin',
  });

  // 경로와 역할 불일치 시 리다이렉트
  if (location.pathname === '/admin' && userRole !== 'admin') {
    console.log('[App] admin 접근 거부 - 고객 화면으로');
    return <CustomerApp user={user} userRole={userRole} onLogout={handleLogout} />;
  }

  if (location.pathname === '/admin' && userRole === 'admin') {
    console.log('[App] admin 화면 렌더링');
    return <AdminApp user={user} onLogout={handleLogout} />;
  }

  console.log('[App] 고객 화면 렌더링');
  return <CustomerApp user={user} userRole={userRole} onLogout={handleLogout} />;
};

export default AppContent;
