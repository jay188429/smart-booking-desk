import React, { useEffect, useRef, useState } from 'react';
import { BRANCHES, type BranchId } from '../utils/branches';

interface Props {
  selectedBranchId: BranchId;
  onSelect: (branchId: BranchId) => void;
}

interface KakaoMapApi {
  maps: {
    LatLng: new (latitude: number, longitude: number) => unknown;
    Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMapInstance;
    Marker: new (options: { map: KakaoMapInstance; position: unknown; title?: string }) => KakaoMarker;
    event: { addListener: (target: KakaoMarker, eventName: string, handler: () => void) => void };
    load: (callback: () => void) => void;
  };
}

interface KakaoMapInstance {
  setCenter: (center: unknown) => void;
}

interface KakaoMarker {
  setMap: (map: KakaoMapInstance | null) => void;
}

declare global {
  interface Window {
    kakao?: KakaoMapApi;
  }
}

const KAKAO_SCRIPT_ID = 'kakao-maps-sdk';

export const BranchMap: React.FC<Props> = ({ selectedBranchId, onSelect }) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const [mapError, setMapError] = useState('');
  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (!appKey || !mapElement.current) return;

    let cancelled = false;
    const renderMap = () => {
      if (cancelled || !mapElement.current || !window.kakao) return;
      const { maps } = window.kakao;
      maps.load(() => {
        if (cancelled || !mapElement.current || !window.kakao) return;
        const center = new maps.LatLng(37.548, 127.026);
        const map = new maps.Map(mapElement.current, { center, level: 8 });
        mapRef.current = map;
        markersRef.current = BRANCHES.map((branch, index) => {
          const marker = new maps.Marker({
            map,
            position: new maps.LatLng(branch.latitude, branch.longitude),
            title: `${branch.name} · ${branch.station}`,
          });
          maps.event.addListener(marker, 'click', () => onSelect(BRANCHES[index].id));
          return marker;
        });
      });
    };

    const existingScript = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    if (window.kakao?.maps) {
      renderMap();
    } else if (existingScript) {
      existingScript.addEventListener('load', renderMap, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = KAKAO_SCRIPT_ID;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
      script.addEventListener('load', renderMap, { once: true });
      script.addEventListener('error', () => setMapError('지도를 불러오지 못했습니다. 아래 지점 목록으로 선택할 수 있습니다.'), { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [appKey, onSelect]);

  const selectBranch = (branchId: BranchId) => {
    onSelect(branchId);
    const branch = BRANCHES.find(item => item.id === branchId);
    if (branch && mapRef.current && window.kakao) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(branch.latitude, branch.longitude));
    }
  };

  return (
    <div className="branch-map-wrap">
      {appKey && !mapError ? <div ref={mapElement} className="branch-map-canvas" aria-label="지점 위치 지도" /> : null}
      {(!appKey || mapError) && (
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
            onClick={() => selectBranch(branch.id)}
          >
            <strong>{branch.name}</strong>
            <span>{branch.station} · 가상 지점</span>
          </button>
        ))}
      </div>
    </div>
  );
};
