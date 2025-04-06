import React, { useState } from 'react';
import { css } from '@emotion/react';
import { Tooltip, Position } from '@blueprintjs/core';
import SimulationListSidebar from './SimulationListSidebar';

// Styles using emotion css
const iconBarStyle = css`
  position: absolute;
  top: 60px;
  left: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  z-index: 9999;
  display: none;
`;

const iconButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  background-repeat: repeat;
  border: 1px solid #444;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  padding: 0;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background-color: rgba(30, 30, 30, 0.8);
  }
  
  &.active {
    background-color: rgba(41, 101, 204, 0.8);
    border-color: #2965CC;
  }
`;

const iconStyle = css`
  width: 16px;
  height: 16px;
`;

const tooltipStyle = css`
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
`;

interface IconButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({ icon, tooltip, onClick, isActive }) => {
  return (
    <Tooltip
      content={<span css={tooltipStyle}>{tooltip}</span>}
      position={Position.RIGHT}
      openOnTargetFocus={false}
    >
      <button 
        css={iconButtonStyle} 
        className={isActive ? 'active' : ''}
        onClick={onClick}
      >
        {icon}
      </button>
    </Tooltip>
  );
};

interface MapMainMenuProps {
}

const MapMainMenu: React.FC<MapMainMenuProps> = () => {
  const [isSimulationListSidebarOpen, setIsSimulationListSidebarOpen] = useState(false);

  const handleHomeClick = () => {
    window.location.href = '/';
  };

  const toggleSimulationListSidebar = () => {
    setIsSimulationListSidebarOpen(!isSimulationListSidebarOpen);
  };

  return (
    <>
      <div css={iconBarStyle}>
        <IconButton
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" css={iconStyle} fill="currentColor"><title>home-outline</title><path d="M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22" /></svg>
          }
          tooltip="HOME"
          onClick={handleHomeClick}
        />
        <IconButton
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" css={iconStyle} fill="currentColor"><title>map-marker-distance</title><path d="M6.5,8.11C5.61,8.11 4.89,7.39 4.89,6.5A1.61,1.61 0 0,1 6.5,4.89C7.39,4.89 8.11,5.61 8.11,6.5V6.5A1.61,1.61 0 0,1 6.5,8.11M6.5,2C4,2 2,4 2,6.5C2,9.87 6.5,14.86 6.5,14.86C6.5,14.86 11,9.87 11,6.5C11,4 9,2 6.5,2M17.5,8.11A1.61,1.61 0 0,1 15.89,6.5C15.89,5.61 16.61,4.89 17.5,4.89C18.39,4.89 19.11,5.61 19.11,6.5A1.61,1.61 0 0,1 17.5,8.11M17.5,2C15,2 13,4 13,6.5C13,9.87 17.5,14.86 17.5,14.86C17.5,14.86 22,9.87 22,6.5C22,4 20,2 17.5,2M17.5,16C16.23,16 15.1,16.8 14.68,18H9.32C8.77,16.44 7.05,15.62 5.5,16.17C3.93,16.72 3.11,18.44 3.66,20C4.22,21.56 5.93,22.38 7.5,21.83C8.35,21.53 9,20.85 9.32,20H14.69C15.24,21.56 16.96,22.38 18.5,21.83C20.08,21.28 20.9,19.56 20.35,18C19.92,16.8 18.78,16 17.5,16V16M17.5,20.5A1.5,1.5 0 0,1 16,19A1.5,1.5 0 0,1 17.5,17.5A1.5,1.5 0 0,1 19,19A1.5,1.5 0 0,1 17.5,20.5Z" /></svg>
          }
          tooltip="SIMULATIONS"
          onClick={toggleSimulationListSidebar}
          isActive={isSimulationListSidebarOpen}
        />
      </div>
      
      <SimulationListSidebar 
        isOpen={isSimulationListSidebarOpen} 
        onClose={() => setIsSimulationListSidebarOpen(false)} 
      />
    </>
  );
};

export default MapMainMenu;
