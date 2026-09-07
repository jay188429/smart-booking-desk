import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleLoginPage } from '../components/GoogleLoginPage';
import { CustomerApp } from './CustomerApp';
import { AdminApp } from './AdminApp';
import { supabase, getUserRole } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log('사용자 확인 시작...');
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        console.log('현재 사용자:', currentUser?.email);

        if (currentUser) {
          setUser(currentUser);
          const role = await getUserRole();
          console.log('사용자 역할:', role);
          setUserRole(role);
        } else {
          console.log('로그인된 사용자 없음');
        }
      } catch (error) {
        console.error('사용자 확인 실패:', error);
      } finally {
        console.log('로딩 완료');
        setLoading(false);
      }
    };

    checkUser();

    // Auth 상태 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const role = await getUserRole();
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return <GoogleLoginPage onLoginSuccess={(newUser) => setUser(newUser)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerApp user={user} userRole={userRole} />} />
        <Route path="/admin" element={userRole === 'admin' ? <AdminApp user={user} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
