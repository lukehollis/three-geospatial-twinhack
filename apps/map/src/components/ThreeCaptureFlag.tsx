/// <reference types="vite/client" />

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Billboard, Box, Sphere, Cone, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Geodetic } from '@takram/three-geospatial';
import { useAtomValue, useSetAtom } from 'jotai'; // Import Jotai hooks
import { blueTeamMessagesAtom, redTeamMessagesAtom, chatService } from '../services/ChatService'; // Import chat atoms and service
import { teamWinAtom } from '../helpers/states'; // Import the win state atom

// Define team colors
const RED_TEAM_COLOR = '#FF0000';
const BLUE_TEAM_COLOR = '#0000FF';
const AGENT_GREEN_COLOR = '#00FF00'; // Color when carrying flag
const BASE_COLOR = '#AAAAAA'; // Color for base markers
const CUBE_SIZE = 400; // Size of the agent cubes
const FLAG_SIZE = 600; // Size of the flag cubes
const BASE_SIZE = 500; // Size for base markers
const FLAG_ALTITUDE_OFFSET = 0; // ALWAYS 0 Altitude offset for flags
const AGENT_ALTITUDE_OFFSET = 0; // ALWAYS 0 Altitude offset for agents
const BASE_ALTITUDE_OFFSET = -100; // Slightly below ground
const API_URL = import.meta.env['VITE_MARL_API_URL'] || 'http://localhost:8888'; // Configurable API URL
const UPDATE_INTERVAL_MS = 200; // How often to call the API (milliseconds)
const COLLISION_THRESHOLD_METERS = 50; // Define collision distance

// Define bounding boxes for random spawning
const BLUE_TEAM_BOUNDS = {
  minLat: 37.75, // Further South
  maxLat: 37.80, // Further North
  minLng: -122.46, // Further West
  maxLng: -122.41, // Further East
};

const RED_TEAM_BOUNDS = {
    minLat: 37.82, // Moved North & East
    maxLat: 37.87, // Moved North & East
    minLng: -122.28, // Moved North & East
    maxLng: -122.22, // Moved North & East
};

// Helper function to generate random positions within bounds
const getRandomPosition = (bounds: typeof BLUE_TEAM_BOUNDS) => ({
    lat: Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat,
    lng: Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng,
});

// --- Interfaces for State ---
interface AgentInfo {
    id: string;
    lat: number;
    lng: number;
    status: number; // 0: active, 1: has_flag
    color: string;
    team: 'blue' | 'red';
}

interface FlagInfo {
    id: 'blue_flag' | 'red_flag';
    lat: number;
    lng: number;
    status: number; // 0: base/dropped, 1: carried
    carrier: string | null;
    color: string;
    team: 'blue' | 'red';
}

// --- NEW: Interface for Base ---
interface BaseInfo {
    id: 'blue_base' | 'red_base';
    lat: number;
    lng: number;
    color: string;
    team: 'blue' | 'red';
}

interface AgentMarkerProps {
    id: string;
    lat: number; // Use current lat/lng
    lng: number; // Use current lat/lng
    color: string;
    status: number;
    isDestroyed: boolean; // NEW: Flag to indicate if visually destroyed
}

// --- Helper: Haversine Distance ---
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = THREE.MathUtils.degToRad(lat1);
    const phi2 = THREE.MathUtils.degToRad(lat2);
    const deltaPhi = THREE.MathUtils.degToRad(lat2 - lat1);
    const deltaLambda = THREE.MathUtils.degToRad(lon2 - lon1);

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}
// --- End Helper ---

const AgentMarker: React.FC<AgentMarkerProps> = ({ id, lat, lng, color, status, isDestroyed }) => {
    const position = useMemo(() => {
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            console.warn(`[AgentMarker] Invalid coordinates for agent ${id}:`, lat, lng);
            return new THREE.Vector3(0, 0, 0); // Default position
        }
        const geodetic = new Geodetic(THREE.MathUtils.degToRad(lng), THREE.MathUtils.degToRad(lat), AGENT_ALTITUDE_OFFSET);
        return geodetic.toECEF();
    }, [lat, lng, id]); // Recompute only when lat/lng/id changes

    // Optional: Add visual indicator for status (e.g., slightly different shape/size if carrying flag)
    const scale = status === 1 ? 1.2 : 1.0; // Make agent slightly bigger if carrying flag

    // --- NEW: Change color if carrying flag ---
    const agentColor = status === 1 ? AGENT_GREEN_COLOR : color;
    // --- END NEW ---

    // Use ChatService for onClick handler
    const handleAgentClick = () => {
        console.log(`Agent ${id} clicked. Requesting chat via ChatService...`);
        const team = id.startsWith('blue') ? 'blue' : 'red';
        // --- Use chatService ---
        chatService.requestTeamChat(id, team, {
            lat,
            lng,
            status,
            message: "Manually requested check-in."
        });
        // --- ---
    };

    return (
        <Billboard position={position} onClick={handleAgentClick}> {/* Add onClick here */}
            {/* NEW: Conditionally render the Box */}
            {!isDestroyed && (
                <Box args={[CUBE_SIZE * scale, CUBE_SIZE * scale, CUBE_SIZE * scale]} renderOrder={1001}>
                    <meshBasicMaterial color={agentColor} transparent opacity={0.8} />
                    {/* Optional: Add Html text label for ID - might get crowded */}
                    {/* <Html position={[0, CUBE_SIZE * 0.7, 0]} center distanceFactor={1000}>
                       <div style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '2px 4px', fontSize: '12px', borderRadius: '3px' }}>
                            {id.split('_')[1]}
                       </div>
                    </Html> */}
                </Box>
            )}
        </Billboard>
    );
};

interface FlagMarkerProps {
    id: string;
    lat: number; // Use current lat/lng
    lng: number; // Use current lat/lng
    color: string;
    status: number; // Flag status
    carrier: string | null; // ID of agent carrying it, if any
}

const FlagMarker: React.FC<FlagMarkerProps> = ({ id, lat, lng, color, status, carrier }) => {
    // Flags are invisible if carried (position is implicitly the agent's position)
    const isVisible = status === 0;

    const position = useMemo(() => {
        if (!isVisible || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            return new THREE.Vector3(0, 0, -10000); // Move offscreen if invalid or carried
        }
        const geodetic = new Geodetic(THREE.MathUtils.degToRad(lng), THREE.MathUtils.degToRad(lat), FLAG_ALTITUDE_OFFSET);
        return geodetic.toECEF();
    }, [lat, lng, id, isVisible]); // Recompute based on visibility too

    if (!isVisible) {
        return null; // Don't render the flag marker itself if carried
    }

    return (
        <Billboard position={position}>
            <Sphere args={[FLAG_SIZE, 16, 8]} renderOrder={1002}> {/* Adjust segments for performance */}
                <meshBasicMaterial color={color} wireframe={false} />
            </Sphere>
        </Billboard>
    );
};

// --- NEW: BaseMarker Component ---
interface BaseMarkerProps {
    id: string;
    lat: number;
    lng: number;
    color: string;
}

const BaseMarker: React.FC<BaseMarkerProps> = ({ id, lat, lng, color }) => {
    const position = useMemo(() => {
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
             console.warn(`[BaseMarker] Invalid coordinates for base ${id}:`, lat, lng);
            return new THREE.Vector3(0, 0, 0);
        }
        // Use BASE_ALTITUDE_OFFSET
        const geodetic = new Geodetic(THREE.MathUtils.degToRad(lng), THREE.MathUtils.degToRad(lat), BASE_ALTITUDE_OFFSET);
        return geodetic.toECEF();
    }, [lat, lng, id]);

    return (
        // Using Billboard so it always faces camera
        <Billboard position={position}>
            {/* Use a Cone or Cylinder for base shape */}
            <Cone args={[BASE_SIZE, BASE_SIZE * 1.5, 4]} renderOrder={1000}> {/* Radius, Height, Segments */}
                <meshBasicMaterial color={color} wireframe={true} />
            </Cone>
        </Billboard>
    );
};
// --- END NEW ---

// --- NEW: Interface for API response including scores ---
interface ApiGameState {
    agents: { [id: string]: { lat: number; lng: number; status: number } };
    blue_flag: { lat: number; lng: number; status: number; carrier: string | null };
    red_flag: { lat: number; lng: number; status: number; carrier: string | null };
    score_blue: number;
    score_red: number;
}
// --- END NEW ---

interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    isComplete: boolean; // To track streaming messages
}

// --- Main Component ---
const ThreeCaptureFlag: React.FC = () => {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [blueFlag, setBlueFlag] = useState<FlagInfo | null>(null);
    const [redFlag, setRedFlag] = useState<FlagInfo | null>(null);
    // --- NEW: State for bases ---
    const [blueBase, setBlueBase] = useState<BaseInfo | null>(null);
    const [redBase, setRedBase] = useState<BaseInfo | null>(null);
    // --- NEW: State for scores ---
    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);
    // --- END NEW ---
    const [isRunning, setIsRunning] = useState(true); // Control simulation loop
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const setTeamWin = useSetAtom(teamWinAtom); // Get the setter for the global atom
    const [destroyedAgentIds, setDestroyedAgentIds] = useState<Set<string>>(new Set()); // NEW: State for destroyed agents

    // --- NEW: Read chat state from atoms ---
    const blueMessages = useAtomValue(blueTeamMessagesAtom);
    const redMessages = useAtomValue(redTeamMessagesAtom);
    // --- END NEW ---

    // Initialize state on mount using the CORRECT helper function
    useEffect(() => {
        const initialState = generateInitialState();
        setAgents(initialState.agents);
        setBlueFlag(initialState.blueFlag);
        setRedFlag(initialState.redFlag);
        setBlueBase(initialState.blueBase);
        setRedBase(initialState.redBase);
        setBlueScore(0);
        setRedScore(0);
        console.log("Initial state set with generateInitialState:", initialState);
    }, []);

    // API call function
    const fetchAndUpdateState = useCallback(async () => {
        if (!blueFlag || !redFlag || !blueBase || !redBase || agents.length === 0) {
            return;
        }

        // --- Get current chat messages inside the callback ---
        // (Using the atom values directly read outside the callback is fine)

        const currentApiState = {
            agents: Object.fromEntries(agents.map(a => [a.id, { lat: a.lat, lng: a.lng, status: a.status }])),
            blue_flag: { lat: blueFlag.lat, lng: blueFlag.lng, status: blueFlag.status, carrier: blueFlag.carrier },
            red_flag: { lat: redFlag.lat, lng: redFlag.lng, status: redFlag.status, carrier: redFlag.carrier },
            blue_base: { lat: blueBase.lat, lng: blueBase.lng },
            red_base: { lat: redBase.lat, lng: redBase.lng },
            // --- NEW: Include current chat messages in the payload ---
            // Consider sending only recent messages or a summary for efficiency if history grows large
            blue_chat: blueMessages, // Send the array of blue messages
            red_chat: redMessages,   // Send the array of red messages
            // --- END NEW ---
        };

        try {
            const response = await fetch(`${API_URL}/step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentApiState),
            });

            if (!response.ok) {
                let errorBody = '';
                try { errorBody = await response.text(); } catch (e) { /* ignore */ }
                console.error('API Error Response Body:', errorBody);
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const nextState: ApiGameState = await response.json();

            // --- Update scores ---
            setBlueScore(nextState.score_blue);
            setRedScore(nextState.score_red);

            // --- CHECK FOR WINNER --- Logic remains largely the same --- START ---
            let determinedWinner: 'blue' | 'red' | null = null;
            const agentMap = new Map(agents.map(a => [a.id, a])); // Use current agents for team lookup

            // Check if Blue team captured Red flag according to nextState
            if (nextState.red_flag.status === 1 && nextState.red_flag.carrier) {
                const carrierAgentInfo = agentMap.get(nextState.red_flag.carrier);
                if (carrierAgentInfo && carrierAgentInfo.team === 'blue') {
                    console.log(`WINNER CHECK: Blue team agent ${carrierAgentInfo.id} captured red flag!`);
                    determinedWinner = 'blue';
                }
            }

            // Check if Red team captured Blue flag (only if blue hasn't won yet)
            if (!determinedWinner && nextState.blue_flag.status === 1 && nextState.blue_flag.carrier) {
                 const carrierAgentInfo = agentMap.get(nextState.blue_flag.carrier);
                 if (carrierAgentInfo && carrierAgentInfo.team === 'red') {
                    console.log(`WINNER CHECK: Red team agent ${carrierAgentInfo.id} captured blue flag!`);
                    determinedWinner = 'red';
                 }
            }
            // --- CHECK FOR WINNER --- Logic remains largely the same --- END ---

            // Apply state updates AFTER checking winner
            // --- Agent State Update (Backend Driven) ---
             // The backend now uses the chat context to decide agent actions (offense/defense),
             // reflected in the returned lat/lng/status.
            const updatedAgents = agents.map(agent => {
                const updatedData = nextState.agents[agent.id];
                 // Keep existing agent info if backend doesn't send update
                 return updatedData ? { ...agent, ...updatedData } : agent;
             }).filter(agent => nextState.agents[agent.id]); // Filter based on backend response keys

             // --- Frontend Collision Detection (Visual Only) ---
             const newlyDestroyed = new Set<string>(destroyedAgentIds);
             const activeAgents = updatedAgents.filter(a => !newlyDestroyed.has(a.id));

             for (let i = 0; i < activeAgents.length; i++) {
                 const agent1 = activeAgents[i];
                 if (newlyDestroyed.has(agent1.id)) continue;

                 for (let j = i + 1; j < activeAgents.length; j++) {
                     const agent2 = activeAgents[j];
                     if (newlyDestroyed.has(agent2.id)) continue;

                     if (agent1.team !== agent2.team) {
                         const distance = haversineDistance(agent1.lat, agent1.lng, agent2.lat, agent2.lng);
                         if (distance < COLLISION_THRESHOLD_METERS) {
                             console.log(`FRONTEND COLLISION: ${agent1.id} and ${agent2.id} visually removed.`);
                             newlyDestroyed.add(agent1.id);
                             newlyDestroyed.add(agent2.id);
                         }
                     }
                 }
             }
            if (newlyDestroyed.size > destroyedAgentIds.size) {
                 setDestroyedAgentIds(newlyDestroyed);
             }

            // Update agents state
             setAgents(updatedAgents);

            // Update flags state
            setBlueFlag(prev => nextState.blue_flag ? { ...(prev ?? {} as FlagInfo), id: 'blue_flag', team: 'blue', color: BLUE_TEAM_COLOR, ...nextState.blue_flag } : prev);
            setRedFlag(prev => nextState.red_flag ? { ...(prev ?? {} as FlagInfo), id: 'red_flag', team: 'red', color: RED_TEAM_COLOR, ...nextState.red_flag } : prev);

            // Set winner state and stop simulation
            if (determinedWinner) {
                setTeamWin(determinedWinner);
                setIsRunning(false);
                console.log(`Simulation stopping. Winner: ${determinedWinner}`);
            }

            // --- Remove periodic chat request trigger from here ---
            // Backend decides when agents chat based on game state and received chat context.
            /*
            if (isRunning && !determinedWinner) {
                updatedAgents.forEach(agent => {
                    if (!newlyDestroyed.has(agent.id) && Math.random() < 0.02) { // Check if not destroyed
                        console.log(`Agent ${agent.id} deciding to chat via ChatService...`);
                        chatService.addChatMessage(agent.team, 'System', `Agent ${agent.id} is requesting a chat.`);
                        chatService.requestTeamChat(agent.id, agent.team, {
                             lat: agent.lat,
                             lng: agent.lng,
                             status: agent.status,
                         });
                    }
                });
            }
            */
            // --- --- END Removal ---

        } catch (error) {
            console.error("Failed to fetch or update state:", error);
            setIsRunning(false);
        }
        // --- Update dependency array --- Includes new chat atoms --- 
    }, [agents, blueFlag, redFlag, blueBase, redBase, isRunning, setTeamWin, destroyedAgentIds, blueMessages, redMessages]);

    // Setup interval for API calls
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(fetchAndUpdateState, UPDATE_INTERVAL_MS);
            console.log("Simulation started");
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                console.log("Simulation stopped");
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                console.log("Simulation interval cleared");
            }
        };
    }, [isRunning, fetchAndUpdateState]);

    // Handler for Start/Stop Button to include game reset
    const handleToggleSimulation = () => {
        if (!isRunning) { // Starting
            const initialState = generateInitialState();
            setAgents(initialState.agents);
            setBlueFlag(initialState.blueFlag);
            setRedFlag(initialState.redFlag);
            setBlueBase(initialState.blueBase);
            setRedBase(initialState.redBase);
            setBlueScore(0);
            setRedScore(0);
            setTeamWin('');
            setDestroyedAgentIds(new Set());
            console.log("Game state reset and simulation starting.");
            setIsRunning(true);
        } else { // Stopping
            setIsRunning(false);
             console.log("Simulation stopping via button.");
        }
    };

    // Render only when flags and bases are initialized
    if (!blueFlag || !redFlag || !blueBase || !redBase) {
        return null;
    }

    return (
        <group>
            {/* Button to toggle simulation */}
            <Html position={[-10000, 10000, 0]} center>
                <button
                    onClick={handleToggleSimulation}
                    style={{ padding: '8px 12px', cursor: 'pointer', zIndex: 10 }}
                >
                    {isRunning ? 'Stop' : 'Start'} Simulation
                </button>
            </Html>

            {/* Scoreboard Display */}
            <Html position={[0, 15000, 0]} center>
                <div style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    justifyContent: 'space-around',
                    minWidth: '150px',
                }}>
                    <span style={{ color: BLUE_TEAM_COLOR }}>Blue: {blueScore}</span>
                    <span style={{ color: RED_TEAM_COLOR }}>Red: {redScore}</span>
                </div>
            </Html>

            {/* Render Agents */}
            {agents.map(agent => (
                <AgentMarker
                    key={agent.id}
                    id={agent.id}
                    lat={agent.lat}
                    lng={agent.lng}
                    color={agent.color}
                    status={agent.status}
                    isDestroyed={destroyedAgentIds.has(agent.id)}
                />
            ))}

            {/* Render Flags */}
            {blueFlag && (
                <FlagMarker
                    key={blueFlag.id}
                    id={blueFlag.id}
                    lat={blueFlag.lat}
                    lng={blueFlag.lng}
                    color={blueFlag.color}
                    status={blueFlag.status}
                    carrier={blueFlag.carrier}
                />
            )}
             {redFlag && (
                <FlagMarker
                    key={redFlag.id}
                    id={redFlag.id}
                    lat={redFlag.lat}
                    lng={redFlag.lng}
                    color={redFlag.color}
                    status={redFlag.status}
                    carrier={redFlag.carrier}
                />
            )}

            {/* Render Bases */}
             {blueBase && <BaseMarker key={blueBase.id} {...blueBase} />}
             {redBase && <BaseMarker key={redBase.id} {...redBase} />}
        </group>
    );
};

export default ThreeCaptureFlag;

// just for dev pupropse so far, add markers here 

// --- Helper: Generate Initial Random State ---
// ** THIS FUNCTION GENERATES THE CORRECT INITIAL STATE STRUCTURE **
const generateInitialState = () => {
    const blueAgents: AgentInfo[] = Array.from({ length: 8 }, (_, i) => ({
        id: `blue_${i}`, // Match backend agent IDs
        ...getRandomPosition(BLUE_TEAM_BOUNDS),
        status: 0, // Include status
        color: BLUE_TEAM_COLOR,
        team: 'blue',
    }));

    const redAgents: AgentInfo[] = Array.from({ length: 8 }, (_, i) => ({
        id: `red_${i}`, // Match backend agent IDs
        ...getRandomPosition(RED_TEAM_BOUNDS),
        status: 0, // Include status
        color: RED_TEAM_COLOR,
        team: 'red',
    }));

    // Flags and Bases start at the same random spot initially
    const initialBlueBasePos = getRandomPosition(BLUE_TEAM_BOUNDS);
    const initialRedBasePos = getRandomPosition(RED_TEAM_BOUNDS);

    const blueFlag: FlagInfo = {
        id: 'blue_flag',
        ...initialBlueBasePos, // Flag starts at base
        status: 0, // Include status
        carrier: null, // Include carrier
        color: BLUE_TEAM_COLOR,
        team: 'blue',
    };

    const redFlag: FlagInfo = {
        id: 'red_flag',
        ...initialRedBasePos, // Flag starts at base
        status: 0, // Include status
        carrier: null, // Include carrier
        color: RED_TEAM_COLOR,
        team: 'red',
    };

    // --- NEW: Define initial bases ---
    const blueBase: BaseInfo = {
        id: 'blue_base',
        ...initialBlueBasePos, // Base position
        color: BASE_COLOR, // Distinct base color
        team: 'blue',
    };

    const redBase: BaseInfo = {
        id: 'red_base',
        ...initialRedBasePos, // Base position
        color: BASE_COLOR, // Distinct base color
        team: 'red',
    };
    // --- END NEW ---

    return {
        agents: [...blueAgents, ...redAgents],
        blueFlag,
        redFlag,
        blueBase, // Return base info
        redBase,   // Return base info
    };
}; 

// webSocketRef.current?.send(JSON.stringify({
//     type: 'request_team_chat',
//     agent_id: 'blue_1', // Example
//     team: 'blue'        // Example
//     // content: 'optional request detail'
// })); 