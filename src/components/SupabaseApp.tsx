import React, { useState, useEffect } from 'react';
import { GoogleLoginPage } from './GoogleLoginPage';
import { CustomerPage } from './CustomerPage';
import { AdminPage } from './AdminPage';
import { DatabaseManager } from '../utils/database';
import { supabase, signOut, getUserRole } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface SupabaseAppProps {
  config: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };
}

export const SupabaseApp: React.FC<SupabaseAppProps> = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [db] = useState(() => new DatabaseManager());

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (currentUser) {
          setUser(currentUser);
          const role = await getUserRole();
          setUserRole(role);
        }
      } catch (error) {
        console.error('사용자 확인 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Auth 상태 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

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
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time" style={{ fontSize: '12px', color: '#666' }}>
            로그인: {user.email} {userRole === 'admin' ? '(관리자)' : '(고객)'}
          </div>
        </div>

        <div className="role-selector">
          <span className="mode-badge supabase">Supabase 모드</span>
          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ padding: '6px 12px', fontSize: '12px', marginLeft: '10px' }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="alert alert-warning">
        <strong>Supabase 모드:</strong> 실제 데이터베이스에 저장됩니다. 로그인한 계정으로 데이터가 저장됩니다.
      </div>

      {userRole === 'admin' ? (
        <AdminPage db={db} mode="supabase" />
      ) : (
        <CustomerPage db={db} mode="supabase" />
      )}

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - Supabase 모드</p>
      </div>
    </div>
  );
};
