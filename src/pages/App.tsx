import React, { useState, useEffect } from 'react';
import { CustomerPage } from '../components/CustomerPage';
import { AdminPage } from '../components/AdminPage';
import { DatabaseManager } from '../utils/database';
import { SupabaseApp } from '../components/SupabaseApp';

type Mode = 'local' | 'supabase';
type Role = 'customer' | 'admin';

const LocalApp: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [mode] = useState<Mode>('local');
  const [role, setRole] = useState<Role>('customer');
  const [db] = useState(() => new DatabaseManager());

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
  };

  const handleResetData = () => {
    if (window.confirm('모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      db.reset();
      window.location.reload();
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time">
            기준 시각: {now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 현재 시각)
          </div>
        </div>

        <div className="role-selector">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>역할</span>
            <button
              className={`btn ${role === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleRoleChange('customer')}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              고객
            </button>
            <button
              className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleRoleChange('admin')}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              어드민
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
            <span className={`mode-badge ${mode}`}>{mode === 'local' ? '로컬 모드' : 'Supabase 모드'}</span>
            <button
              className="btn btn-secondary"
              onClick={handleResetData}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              데이터 초기화
            </button>
          </div>
        </div>
      </div>

      {mode === 'local' && (
        <div className="alert alert-info">
          <strong>로컬 모드:</strong> 브라우저 로컬 스토리지에 데이터를 저장합니다. 진짜 인증이 아닌 수업용 데모입니다.
          역할 전환은 이 모드에만 있습니다.
        </div>
      )}

      {mode === 'supabase' && (
        <div className="alert alert-warning">
          <strong>Supabase 모드:</strong> 실제 데이터베이스와 인증이 적용됩니다. 환경 변수 설정 필요합니다.
          (미구현 - 현재 로컬 모드만 지원)
        </div>
      )}

      {role === 'customer' && <CustomerPage db={db} mode={mode} />}
      {role === 'admin' && <AdminPage db={db} mode={mode} />}

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 수업용 기본 실습 앱</p>
        <p>기본값: 42슬롯(14일 × 3시간대), 고객 1-3개 희망, 어드민 수동 확정</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const env = import.meta.env;
  const configuredMode = env.VITE_APP_MODE || 'local';
  const [mode, setMode] = useState(configuredMode);
  if (mode !== 'local' && mode !== 'supabase') return <p role="alert">VITE_APP_MODE는 local 또는 supabase로 설정하세요.</p>;
  return <>
    <div className="container"><label htmlFor="connection-mode">접속 모드 </label><select id="connection-mode" value={mode} onChange={event => setMode(event.target.value)}><option value="local">로컬 수업용 미리보기</option><option value="supabase">Supabase 실제 저장</option></select></div>
    {mode === 'supabase' ? <SupabaseApp config={{ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY }} /> : <LocalApp />}
  </>;
};
export default App;
