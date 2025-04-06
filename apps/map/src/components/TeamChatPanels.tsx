// add two chat panels, one for blue and one for red 
// each panel should have a header with the team name and a button to clear the chat 
// the chat should be displayed in a scrollable div 

import React, { useRef, useEffect, useState } from 'react';
// Re-add Jotai and ChatService imports
import { useAtomValue } from 'jotai';
import { blueTeamMessagesAtom, redTeamMessagesAtom, chatService } from '../services/ChatService';
// Import the ChatMessage type if needed by TeamChatPanel props
import type { ChatMessage } from '../services/ChatService';

// Keep the interface definition locally if it's not imported elsewhere
/*
interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    isComplete: boolean;
}
*/

const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '80px', // Adjust as needed, below other UI elements
    bottom: '120px',
    width: '280px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)', // For Safari
    borderRadius: '8px',
    color: 'white',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'monospace',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 1100, // Ensure it's above map but potentially below modals
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
    marginBottom: '8px',
};

const scrollableStyle: React.CSSProperties = {
    flexGrow: 1,
    overflowY: 'auto',
    paddingRight: '5px', // Prevent scrollbar overlap
};

const messageStyle: React.CSSProperties = {
    marginBottom: '6px',
    lineHeight: '1.4',
};

const senderStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginRight: '5px',
};

// Removed the standalone addChatMessage function here

const TeamChatPanel: React.FC<{
    teamName: string;
    teamColor: string;
    messages: ChatMessage[];
    onClear: () => void;
    style?: React.CSSProperties;
}> = ({ teamName, teamColor, messages, onClear, style }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]); // Trigger scroll on new messages

    return (
        <div style={{ ...panelStyle, ...style }}>
            <div style={headerStyle}>
                <h3 style={{ margin: 0, color: teamColor }}>{teamName} Chat</h3>
                <button onClick={onClear} style={{ cursor: 'pointer' }}>Clear</button>
            </div>
            <div ref={scrollRef} style={scrollableStyle}>
                {/* Static test message */}
                <div style={messageStyle}>
                    <span style={{ ...senderStyle, color: teamColor }}>System:</span>
                    <span>{teamName} requesting agent plan . . .</span>
                </div>

                {/* --- SIMPLIFIED DYNAMIC RENDER (Still driven by passed 'messages' prop) --- */}
                {messages.map((msg, index) => (
                    <div key={`${msg.sender}-${msg.timestamp}-${index}`} style={{ border: '1px dotted white', margin: '4px', padding: '8px', color: 'white', fontSize: '12px' }}>
                         <strong>{msg.sender}:</strong> {msg.message || 'NO MESSAGE CONTENT'}
                    </div>
                ))}
                 {/* Keyframes style */}
                 <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
            </div>
        </div>
    );
};

const TeamChatPanels: React.FC = () => {
    // --- Atom State Reading ---
    const blueMessagesFromAtom = useAtomValue(blueTeamMessagesAtom);
    const redMessagesFromAtom = useAtomValue(redTeamMessagesAtom);

    // --- Clear Handlers ---
    const handleClearBlue = () => {
        chatService.clearTeamMessages('blue');
    };
    const handleClearRed = () => {
        chatService.clearTeamMessages('red');
    };

    // --- Log Atom State ---
    console.log('[TeamChatPanels] ATOM  Blue:', blueMessagesFromAtom);
    console.log('[TeamChatPanels] ATOM  Red:', redMessagesFromAtom);

    // --- Effect to request LLM chat periodically ---
    useEffect(() => {
        console.log('[TeamChatPanels] Setting up chat request intervals...');

        // Placeholder IDs and context - ADJUST AS NEEDED
        const blueAgentId = 'BlueSystem';
        const redAgentId = 'RedSystem';
        const context = {}; // Add relevant context if required by backend

        let blueIntervalId: NodeJS.Timeout | null = null;
        let redIntervalId: NodeJS.Timeout | null = null;

        const scheduleNextBlueRequest = () => {
            const delay = Math.random() * 5000 + 3000; // Request every 3-8 seconds
            blueIntervalId = setTimeout(() => {
                console.log(`[TeamChatPanels] Requesting BLUE chat for ${blueAgentId}`);
                try {
                    // Call the actual chat service request method
                    chatService.requestTeamChat(blueAgentId, 'blue', context);
                } catch (error) {
                    console.error("[TeamChatPanels] Error calling chatService.requestTeamChat (Blue):", error);
                }
                scheduleNextBlueRequest(); // Schedule the next one
            }, delay);
        };

        const scheduleNextRedRequest = () => {
            const delay = Math.random() * 5000 + 3000; // Request every 3-8 seconds
            redIntervalId = setTimeout(() => {
                 console.log(`[TeamChatPanels] Requesting RED chat for ${redAgentId}`);
                try {
                     // Call the actual chat service request method
                    chatService.requestTeamChat(redAgentId, 'red', context);
                } catch (error) {
                     console.error("[TeamChatPanels] Error calling chatService.requestTeamChat (Red):", error);
                }
                scheduleNextRedRequest(); // Schedule the next one
            }, delay);
        };

        // Start the request loops
        scheduleNextBlueRequest();
        scheduleNextRedRequest();

        // Cleanup function
        return () => {
            console.log('[TeamChatPanels] Clearing chat request intervals.');
            if (blueIntervalId) clearTimeout(blueIntervalId);
            if (redIntervalId) clearTimeout(redIntervalId);
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    return (
        <>
            {/* Blue Team Panel (Driven by ATOM state) */}
            <TeamChatPanel
                teamName="Blue Team"
                teamColor="#00A0FF"
                messages={blueMessagesFromAtom}
                onClear={handleClearBlue}
                style={{ left: '10px' }}
            />

            {/* Red Team Panel (Driven by ATOM state) */}
             <TeamChatPanel
                teamName="Red Team"
                teamColor="#FF5050"
                messages={redMessagesFromAtom}
                onClear={handleClearRed}
                style={{ right: '10px' }}
            />
        </>
    );
};

export default TeamChatPanels;
