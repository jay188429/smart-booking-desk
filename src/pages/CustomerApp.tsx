import React, { useState, useEffect } from 'react';
import { CustomerPage } from '../components/CustomerPage';
import { DatabaseManager } from '../utils/database';

const CustomerApp: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const [db] = useState(() => new DatabaseManager());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
        </div>
      </div>

      <div className="alert alert-info">
        <strong>고객 화면:</strong> 예약 신청, 상태 확인, 재선택
      </div>

      <CustomerPage db={db} mode="local" />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 고객 화면</p>
        <p><a href="/admin">어드민 화면으로 이동</a></p>
      </div>
    </div>
  );
};

export default CustomerApp;
