import React, { useState } from 'react';
import { CustomerPage } from '../components/CustomerPage';
import { AdminPage } from '../components/AdminPage';
import { DatabaseManager } from '../utils/database';
import type { User } from '@supabase/supabase-js';

interface Props { user: User; onLogout: () => void }

export const LocalDemoApp: React.FC<Props> = ({ user, onLogout }) => {
  const [db] = useState(() => new DatabaseManager());
  const [role, setRole] = useState<'customer' | 'admin'>('customer');
  const [revision, setRevision] = useState(0);

  const resetDemo = () => {
    if (window.confirm('로컬 데모 데이터를 초기화할까요?')) {
      db.reset();
      setRevision(value => value + 1);
      setRole('customer');
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time">로컬 수업용 · {user.email} · C01/C02 시나리오</div>
        </div>
        <div className="role-selector">
          <span className="mode-badge local">로컬 모드</span>
          <button className={role === 'customer' ? 'active' : ''} onClick={() => setRole('customer')}>고객</button>
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>관리자</button>
          <button onClick={resetDemo}>데모 초기화</button>
          <button onClick={onLogout}>로그아웃</button>
        </div>
      </div>
      <div className="alert alert-warning">
        로컬 수업용 미리보기입니다. 실제 Supabase 데이터에는 저장되지 않습니다.
      </div>
      {role === 'customer' ? <CustomerPage key={`customer-${revision}`} db={db} mode="local" /> : <AdminPage key={`admin-${revision}`} db={db} mode="local" />}
    </div>
  );
};
