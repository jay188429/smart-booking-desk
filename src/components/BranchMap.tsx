import React from 'react';
import { BRANCHES, type BranchId } from '../utils/branches';

interface Props {
  selectedBranchId: BranchId;
  onSelect: (branchId: BranchId) => void;
}

const buildMapUrl = (apiKey: string, branchId: BranchId) => {
  const branch = BRANCHES.find(item => item.id === branchId) ?? BRANCHES[0];
  const params = new URLSearchParams({
    style: 'osm-bright', width: '900', height: '320', center: `lonlat:${branch.longitude},${branch.latitude}`, zoom: '14',
    format: 'png', apiKey,
  });
  params.append('marker', `lonlat:${branch.longitude},${branch.latitude};type:material;color:#6de0d0;size:42;text:${branch.name.replace('지점', '')}`);
  return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
};

export const BranchMap: React.FC<Props> = ({ selectedBranchId, onSelect }) => {
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

  return (
    <div className="branch-map-wrap">
      {apiKey ? (
        <figure className="branch-map-figure">
          <img className="branch-map-image" src={buildMapUrl(apiKey, selectedBranchId)} alt={`${BRANCHES.find(branch => branch.id === selectedBranchId)?.name ?? '선택한 지점'} 위치 지도`} />
          <figcaption>© OpenStreetMap contributors · © Geoapify · 실제 매장이 아닌 역 인근 기준의 가상 지점</figcaption>
        </figure>
      ) : (
        <div className="branch-map-fallback" role="status">
          <strong>지도 키를 설정하면 역 중심 지도를 표시합니다.</strong>
          <span>실제 매장이 아닌 역 인근 기준의 가상 지점입니다.</span>
        </div>
      )}
      <div className="branch-map-list" aria-label="지점 목록">
        {BRANCHES.map(branch => (
          <button key={branch.id} type="button" className={`branch-map-item${selectedBranchId === branch.id ? ' selected' : ''}`} onClick={() => onSelect(branch.id)}>
            <strong>{branch.name}</strong>
            <span>{branch.station} · 가상 지점</span>
          </button>
        ))}
      </div>
    </div>
  );
};
