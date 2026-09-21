import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import DriverAuthView from './views/DriverAuthView';
import AuthView from './views/AuthView';
import AdminAuthView from './views/AdminAuthView';
import AdminTwin3D from './views/AdminTwin3D';
import DriverMobile from './views/DriverMobile';
import { socketService } from './services/socket';
import { GridStatePayload, AnomalyPayload, SwapSuccessPayload } from './types/zeus';
import { getStoredUser } from './services/firebase';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [gridState, setGridState] = useState<GridStatePayload | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyPayload | null>(null);
  const [swapInfo, setSwapInfo] = useState<SwapSuccessPayload | null>(null);

  useEffect(() => {
    // Connect backend WebSocket if running on desktop browser / electron
    const isMobile = !!(window as any).Capacitor?.isNativePlatform() || window.location.protocol === 'capacitor:';
    if (!isMobile) {
      socketService.connect({
        url: `ws://${window.location.hostname || 'localhost'}:8000/ws/grid`,
        onConnect: () => setConnected(true),
        onDisconnect: () => setConnected(false),
        onMessage: (msg) => {
          switch (msg.type) {
            case 'GRID_STATE':
              setGridState(msg);
              break;
            case 'ANOMALY_ALERT':
              setAnomaly(msg);
              break;
            case 'SWAP_SUCCESS':
              setSwapInfo(msg);
              break;
            default:
              break;
          }
        },
      });
      return () => socketService.disconnect();
    }
  }, []);

  const hasUser = !!getStoredUser();
  const isMobile = !!(window as any).Capacitor?.isNativePlatform() || window.location.protocol === 'capacitor:';

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<DriverAuthView />} />
        <Route path="/select" element={<AuthView />} />
        <Route path="/admin/login" element={<AdminAuthView />} />
        <Route
          path="/admin"
          element={
            <AdminTwin3D
              connected={connected}
              gridState={gridState}
              anomaly={anomaly}
              swapInfo={swapInfo}
            />
          }
        />
        <Route path="/driver" element={<DriverMobile />} />
        <Route path="/" element={<Navigate to={isMobile ? (hasUser ? '/driver' : '/login') : '/admin'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
