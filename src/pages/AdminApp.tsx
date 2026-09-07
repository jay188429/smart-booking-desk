import React, { useState, useEffect } from 'react';
import { AdminPage } from '../components/AdminPage';
import { DatabaseManager } from '../utils/database';

const AdminApp: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const [db] = useState(() => new DatabaseManager());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
          <span className="mode-badge local">로컬 모드</span>
          <button
            className="btn btn-secondary"
            onClick={handleResetData}
            style={{ padding: '6px 12px', fontSize: '12px', marginLeft: '10px' }}
          >
            데이터 초기화
          </button>
        </div>
      </div>

      <div className="alert alert-warning">
        <strong>어드민 화면:</strong> 신청 확인, 수동 확정, 실행 기록
      </div>

      <AdminPage db={db} mode="local" />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 어드민 화면</p>
        <p><a href="/">고객 화면으로 이동</a></p>
      </div>
    </div>
  );
};

export default AdminApp;
