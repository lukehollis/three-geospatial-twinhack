import React from 'react';
import { css } from '@emotion/react';
import { Tooltip, Position } from '@blueprintjs/core';
import { useAtom } from 'jotai';
import { atom } from 'jotai';

// Create an atom to store the current weather state
export const cloudCoverageAtom = atom<number>(0.3); // Default to partly cloudy (0.3)

// Styles using emotion css
const weatherControlStyle = css`
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  flex-direction: row;
  gap: 8px;
  padding: 8px;
  z-index: 1;

  @media (max-width: 1120px) {
    display:none;
  }
`;

const weatherButtonStyle = (isActive: boolean) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: ${isActive ? 'rgba(0, 120, 215, 0.8)' : 'rgba(0, 0, 0, 0.7)'};
  border-radius: 50%;
  border: 1px solid ${isActive ? '#0078d7' : '#444'};
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  padding: 0;

  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background-color: ${isActive ? 'rgba(0, 120, 215, 0.9)' : 'rgba(0, 0, 0, 0.8)'};
    transform: scale(1.05);
  }
`;

const iconStyle = css`
  width: 20px;
  height: 20px;
`;

const tooltipStyle = css`
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
`;

interface WeatherButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  isActive: boolean;
}

const WeatherButton: React.FC<WeatherButtonProps> = ({ icon, tooltip, onClick, isActive }) => {
  return (
    <Tooltip
      content={<span css={tooltipStyle}>{tooltip}</span>}
      position={Position.TOP}
      openOnTargetFocus={false}
    >
      <button css={weatherButtonStyle(isActive)} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
};

const WeatherControlMenu: React.FC = () => {
  const [cloudCoverage, setCloudCoverage] = useAtom(cloudCoverageAtom);

  const handleSunClick = () => {
    setCloudCoverage(0);
  };

  const handlePartlyCloudyClick = () => {
    setCloudCoverage(0.3);
  };

  const handleRainClick = () => {
    setCloudCoverage(1);
  };

  return (
    <div css={weatherControlStyle}>
      <WeatherButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" css={iconStyle} fill="currentColor"><title>weather-sunny</title><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z" /></svg>
        }
        tooltip="SUNNY"
        onClick={handleSunClick}
        isActive={cloudCoverage === 0}
      />
      <WeatherButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" css={iconStyle} fill="currentColor">
            <title>weather-partly-cloudy</title><path d="M12.74,5.47C15.1,6.5 16.35,9.03 15.92,11.46C17.19,12.56 18,14.19 18,16V16.17C18.31,16.06 18.65,16 19,16A3,3 0 0,1 22,19A3,3 0 0,1 19,22H6A4,4 0 0,1 2,18A4,4 0 0,1 6,14H6.27C5,12.45 4.6,10.24 5.5,8.26C6.72,5.5 9.97,4.24 12.74,5.47M11.93,7.3C10.16,6.5 8.09,7.31 7.31,9.07C6.85,10.09 6.93,11.22 7.41,12.13C8.5,10.83 10.16,10 12,10C12.7,10 13.38,10.12 14,10.34C13.94,9.06 13.18,7.86 11.93,7.3M13.55,3.64C13,3.4 12.45,3.23 11.88,3.12L14.37,1.82L15.27,4.71C14.76,4.29 14.19,3.93 13.55,3.64M6.09,4.44C5.6,4.79 5.17,5.19 4.8,5.63L4.91,2.82L7.87,3.5C7.25,3.71 6.65,4.03 6.09,4.44M18,9.71C17.91,9.12 17.78,8.55 17.59,8L19.97,9.5L17.92,11.73C18.03,11.08 18.05,10.4 18,9.71M3.04,11.3C3.11,11.9 3.24,12.47 3.43,13L1.06,11.5L3.1,9.28C3,9.93 2.97,10.61 3.04,11.3M19,18H16V16A4,4 0 0,0 12,12A4,4 0 0,0 8,16H6A2,2 0 0,0 4,18A2,2 0 0,0 6,20H19A1,1 0 0,0 20,19A1,1 0 0,0 19,18Z" />
          </svg>
        }
        tooltip="PARTLY CLOUDY"
        onClick={handlePartlyCloudyClick}
        isActive={cloudCoverage === 0.3}
      />
      <WeatherButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" css={iconStyle} fill="currentColor">
            <title>weather-pouring</title><path d="M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z" />
          </svg>
        }
        tooltip="RAINY"
        onClick={handleRainClick}
        isActive={cloudCoverage === 1}
      />
    </div>
  );
};

export default WeatherControlMenu;
