import React from 'react';
import { css } from '@emotion/react';
import { Button, Checkbox } from '@blueprintjs/core';
import { useAtom } from 'jotai';
import { mapViewModeAtom, showRealtimeDataAtom } from '../helpers/states';

const MapToolbar: React.FC = () => {
  const [mapViewMode, setMapViewMode] = useAtom(mapViewModeAtom);
  const [showRealtimeData, setShowRealtimeData] = useAtom(showRealtimeDataAtom);

  const toggleMapViewMode = () => {
    setMapViewMode(mapViewMode === '2D' ? '3D' : '2D');
  };

  const handleRealtimeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowRealtimeData(event.target.checked);
  };

  return (
    <div css={toolbarStyle}>
      <Checkbox
        checked={showRealtimeData}
        label="Realtime"
        onChange={handleRealtimeToggle}
        css={checkboxStyle}
        style={{
          margin: '0 ',
          padding: '8px 12px 8px 36px',
        }}
      />
      <Button
        icon={mapViewMode === '2D' ? 'cube' : 'map'}
        small
        minimal
        onClick={toggleMapViewMode}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '8px',
          border: '1px solid #444',
          color: 'white',
          padding: '8px 12px',
          backgroundImage: 'none',
          backdropFilter: 'blur(5px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          textTransform: 'uppercase',
          fontSize: '10px',
          fontWeight: 'bold'
        }}
      >
        {mapViewMode === '2D' ? '3D' : '2D'}
      </Button>
    </div>
  );
};

const toolbarStyle = css`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const checkboxStyle = css`
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  border: 1px solid #444;
  color: white;
  padding: 8px 12px 8px 24px;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
  font-size: 10px;
  font-weight: bold;

  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
  
`;

export default MapToolbar;