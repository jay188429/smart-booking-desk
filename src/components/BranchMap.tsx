import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BRANCHES, type BranchId } from '../utils/branches';

interface Props {
  selectedBranchId: BranchId;
  onSelect: (branchId: BranchId) => void;
}

interface GoogleMapApi {
  maps: {
    LatLng: new (latitude: number, longitude: number) => unknown;
    Map: new (container: HTMLElement, options: { center: unknown; zoom: number; mapId: string }) => GoogleMapInstance;
    Marker: new (options: { map: GoogleMapInstance; position: unknown; title?: string }) => GoogleMarker;
    event: { addListener: (target: GoogleMarker, eventName: string, handler: () => void) => void };
  };
}

interface GoogleMapInstance {
  setCenter: (center: unknown) => void;
}

interface GoogleMarker {
  setMap: (map: GoogleMapInstance | null) => void;
}

declare global {
  interface Window {
    google?: GoogleMapApi;
  }
}

const GOOGLE_SCRIPT_ID = 'google-maps-sdk';
const GOOGLE_CALLBACK = '__smartBookingGoogleMapsLoaded';

export const BranchMap: React.FC<Props> = ({ selectedBranchId, onSelect }) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const [mapError, setMapError] = useState('');
  const [modalBranchId, setModalBranchId] = useState<BranchId | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const openBranch = useCallback((branchId: BranchId) => {
    setModalBranchId(branchId);
    const branch = BRANCHES.find(item => item.id === branchId);
    if (branch && mapRef.current && window.google) {
      mapRef.current.setCenter(new window.google.maps.LatLng(branch.latitude, branch.longitude));
    }
  }, []);

  useEffect(() => {
    if (!apiKey || !mapElement.current) return;

    let cancelled = false;
    const renderMap = () => {
      if (cancelled || !mapElement.current || !window.google) return;
      const { maps } = window.google;
      const center = new maps.LatLng(37.548, 127.026);
      const map = new maps.Map(mapElement.current, { center, zoom: 11, mapId: 'DEMO_MAP_ID' });
      mapRef.current = map;
      markersRef.current = BRANCHES.map((branch, index) => {
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(branch.latitude, branch.longitude),
          title: `${branch.name} · ${branch.station}`,
        });
        maps.event.addListener(marker, 'click', () => openBranch(BRANCHES[index].id));
        return marker;
      });
    };

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const globalWindow = window as unknown as Record<string, () => void>;
    globalWindow[GOOGLE_CALLBACK] = renderMap;
    if (window.google?.maps) {
      renderMap();
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=maps&loading=async&callback=${GOOGLE_CALLBACK}`;
      script.addEventListener('error', () => setMapError('지도를 불러오지 못했습니다. 아래 지점 목록으로 선택할 수 있습니다.'), { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
      delete globalWindow[GOOGLE_CALLBACK];
    };
  }, [apiKey, openBranch]);

  const modalBranch = modalBranchId ? BRANCHES.find(branch => branch.id === modalBranchId) : undefined;
  const confirmBranch = () => {
    if (modalBranch) onSelect(modalBranch.id);
    setModalBranchId(null);
  };

  return (
    <div className="branch-map-wrap">
      {apiKey && !mapError ? <div ref={mapElement} className="branch-map-canvas" aria-label="지점 위치 지도" /> : null}
      {(!apiKey || mapError) && (
        <div className="branch-map-fallback" role="status">
          <strong>{mapError || '지도 키를 설정하면 역 중심 지도를 표시합니다.'}</strong>
          <span>실제 매장이 아닌 역 인근 기준의 가상 지점입니다.</span>
        </div>
      )}
      <div className="branch-map-list" aria-label="지점 목록">
        {BRANCHES.map(branch => (
          <button
            key={branch.id}
            type="button"
            className={`branch-map-item${selectedBranchId === branch.id ? ' selected' : ''}`}
            onClick={() => openBranch(branch.id)}
          >
            <strong>{branch.name}</strong>
            <span>{branch.station} · 가상 지점</span>
          </button>
        ))}
      </div>
      {modalBranch && (
        <div className="branch-map-modal-backdrop" role="presentation" onMouseDown={() => setModalBranchId(null)}>
          <section
            className="branch-map-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-map-modal-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="branch-map-modal-heading">
              <div>
                <span className="eyebrow">지점 위치</span>
                <h3 id="branch-map-modal-title">{modalBranch.name}</h3>
              </div>
              <button type="button" className="branch-map-modal-close" onClick={() => setModalBranchId(null)} aria-label="위치 모달 닫기">×</button>
            </div>
            <p className="branch-map-modal-station">{modalBranch.station} 인근</p>
            <p className="branch-map-modal-note">실제 매장이 아닌 역 인근 기준의 가상 지점입니다.</p>
            <div className="branch-map-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalBranchId(null)}>닫기</button>
              <button type="button" className="btn btn-primary" onClick={confirmBranch}>이 지점 선택</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
