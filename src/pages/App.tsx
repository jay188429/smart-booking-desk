import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CustomerApp } from './CustomerApp';
import { AdminApp } from './AdminApp';

const LocalApp: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerApp user={{ email: 'customer@test.com' } as any} userRole={null} />} />
        <Route path="/admin" element={<AdminApp user={{ email: 'admin@test.com' } as any} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default LocalApp;
