import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type ViewRole = 'ADMIN' | 'DRIVER';

export default function AuthView() {
  const [role, setRole] = useState<ViewRole>('ADMIN');
  const navigate = useNavigate();

  const proceed = () => {
    if (role === 'ADMIN') navigate('/admin/login');
    else navigate('/driver');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zeus-canvas">
      <div className="glass-panel p-8 rounded-3xl shadow-glass w-96">
        <h1 className="text-2xl font-bold text-zeus-heading mb-6 text-center">
          Zeus OS – Role Selection
        </h1>
        <div className="flex flex-col space-y-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="role"
              value="ADMIN"
              checked={role === 'ADMIN'}
              onChange={() => setRole('ADMIN')}
              className="form-radio h-4 w-4 text-zeus-accent"
            />
            <span className="text-zeus-text">Command Center (Admin)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="role"
              value="DRIVER"
              checked={role === 'DRIVER'}
              onChange={() => setRole('DRIVER')}
              className="form-radio h-4 w-4 text-zeus-accent"
            />
            <span className="text-zeus-text">In‑Cabin Driver App</span>
          </label>
        </div>
        <button
          onClick={proceed}
          className="zeus-btn-primary w-full mt-6"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
