// TeamWinStatePanel.tsx
// This component displays the current winning team
import React from 'react';
import { useAtomValue } from 'jotai';
import { teamWinAtom } from '../helpers/states';

const TeamWinStatePanel: React.FC = () => {
    const winner = useAtomValue(teamWinAtom);

    if (!winner) {
        return null; // Don't render anything if there is no winner
    }

    // Determine background color based on winner
    const backgroundColor = winner === 'blue' ? 'rgba(0, 0, 255, 0.6)' : 'rgba(255, 0, 0, 0.6)';
    const message = winner === 'blue' ? 'Blue Team Wins!' : 'Red Team Wins!';

    return (
        <div style={{
            position: 'fixed', // Use fixed to position relative to viewport
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)', // Center precisely
            padding: '30px 60px',
            backgroundColor: backgroundColor,
            color: 'white',
            fontSize: '60px',
            fontWeight: 'bold',
            borderRadius: '15px',
            textAlign: 'center',
            zIndex: 2000, // High z-index to ensure it's on top of the canvas
            border: '3px solid white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        }}>
            {message}
        </div>
    );
};

export default TeamWinStatePanel;