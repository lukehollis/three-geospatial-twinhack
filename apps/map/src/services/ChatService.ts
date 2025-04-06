// chat service for the map  here we will handle the chat messages and the chat history 

import { simulationService } from './SimulationService';
import { addDebugMessage } from '../components/InfoPanel';
import { atom, getDefaultStore } from 'jotai';

// Define the chat message structure if not already shared
export interface ChatMessage {
    sender: string;
    message: string;
    timestamp: number;
    isComplete: boolean;
}

// Atoms to hold the message arrays for each team
export const blueTeamMessagesAtom = atom<ChatMessage[]>([]);
export const redTeamMessagesAtom = atom<ChatMessage[]>([]);

// Function to get the default store instance used by the Provider
export const getChatStore = () => getDefaultStore();

// Optional: Atom to track the last received WS message relevant to chat
// This could be used internally by ChatService to manage streaming
export const lastChatMessageEventAtom = atom<any | null>(null);

class ChatServiceController {

    /**
     * Directly adds a completed chat message to the specified team's panel.
     * Uses the globally shared Jotai store.
     */
    public addChatMessage(team: 'red' | 'blue', sender: string, message: string): void {
        const newMessage: ChatMessage = {
            sender,
            message,
            timestamp: Date.now() / 1000,
            isComplete: true,
        };
        const store = getChatStore(); // Get the shared store instance
        const targetAtom = team === 'blue' ? blueTeamMessagesAtom : redTeamMessagesAtom;

        // --- DEBUG: Log before update ---
        const currentState = store.get(targetAtom);
        console.log(`[ChatService.addChatMessage] Team: ${team}, Sender: ${sender}, Message: ${message}`);
        console.log(`[ChatService.addChatMessage] State BEFORE update for ${team}:`, currentState);
        // ---

        store.set(targetAtom, (prev) => [...prev, newMessage]);

        // --- DEBUG: Log after update ---
        const newState = store.get(targetAtom);
        console.log(`[ChatService.addChatMessage] State AFTER update for ${team}:`, newState);
        if (newState.length === currentState.length) {
            console.error(`[ChatService.addChatMessage] CRITICAL: Atom state did NOT change for ${team} after set!`);
        } else {
             console.log(`[ChatService.addChatMessage] Atom state for ${team} successfully updated.`);
        }
        // ---
    }

    /**
     * Sends a request to the backend via WebSocket to generate a team chat message (LLM response).
     * @param agentId The ID of the agent initiating the chat.
     * @param team The team ('red' or 'blue') the agent belongs to.
     * @param context Additional context for the LLM prompt.
     */
    public requestTeamChat(agentId: string, team: 'red' | 'blue', context: any): void {
        if (!agentId || !team) {
            addDebugMessage('[ChatService Error] Agent ID and team are required to request chat.');
            return;
        }

        const messagePayload = {
            type: 'request_team_chat',
            agent_id: agentId,
            team: team,
            context: context || {}
        };

        addDebugMessage(`[ChatService] Requesting LLM chat for ${agentId} (Team: ${team})`);

        // --- Add the initial "requesting" message locally ---
        this.addChatMessage(team, 'System', `Agent ${agentId} requesting chat...`);


        // Send the request using SimulationService's method
        simulationService.sendRawWebSocketMessage(messagePayload)
            .catch((error: any) => {
                 addDebugMessage(`[ChatService Error] Failed to send chat request for ${agentId}: ${error?.message || error}`);
                 this.addChatMessage(team, 'System', `Error sending chat request for ${agentId}.`);
            });
    }

    /**
     * Processes relevant WebSocket message data to update chat atoms.
     * This should be called by the service handling the WS connection (e.g., SimulationService).
     * @param wsMessage The relevant message data received from the WebSocket.
     */
    public processWebSocketMessage(wsMessage: any): void {
        if (!wsMessage || typeof wsMessage !== 'object') return;

        const { type, team, sender, delta, timestamp } = wsMessage;

        // Only process chat-related stream messages here
        if (!type?.startsWith('team_chat_')) {
             // console.log('[ChatService] Ignoring non-chat WS message type:', type); // Optional debug
             return;
        }
        if (team !== 'blue' && team !== 'red') {
             console.warn('[ChatService] Ignoring chat message with invalid team:', team, wsMessage);
             return;
        }

        // --- DEBUG LOG: See what's being processed ---
        console.log(`[ChatService.processWebSocketMessage] Processing WS message type: ${type} for team: ${team}`);
        // ---

        const targetAtom = team === 'blue' ? blueTeamMessagesAtom : redTeamMessagesAtom;
        const store = getChatStore(); // Get the shared store instance

        try {
            if (type === 'team_chat_stream_start') {
                 // --- DEBUG LOG ---
                 console.log(`[ChatService.processWebSocketMessage] Handling START for sender: ${sender}`);
                 const currentState = store.get(targetAtom);
                 console.log(`[ChatService.processWebSocketMessage] State BEFORE START update for ${team}:`, currentState);
                const newMessage: ChatMessage = { sender: sender || 'Unknown', message: '', timestamp: timestamp || Date.now() / 1000, isComplete: false };
                store.set(targetAtom, (prev) => [...prev, newMessage]);
                const newState = store.get(targetAtom);
                console.log(`[ChatService.processWebSocketMessage] State AFTER START update for ${team}:`, newState);
            } else if (type === 'team_chat_message_delta') {
                 // --- DEBUG LOG ---
                 // console.log(`[ChatService.processWebSocketMessage] Handling DELTA for sender: ${sender}, delta: "${delta}"`); // Can be noisy
                 const currentState = store.get(targetAtom);
                 store.set(targetAtom, (prev) => prev.map((msg, index) =>
                    (index === prev.length - 1 && msg.sender === sender && !msg.isComplete)
                        ? { ...msg, message: msg.message + (delta || '') } : msg
                ));
                 const newState = store.get(targetAtom);
                 // Avoid logging spam on every delta, only log if state seems unchanged
                 if (newState.length > 0 && currentState.length > 0 && newState[newState.length-1]?.message === currentState[currentState.length-1]?.message && delta) {
                     console.warn(`[ChatService.processWebSocketMessage] State may not have updated after DELTA for ${team}. Delta: "${delta}"`);
                 }
            } else if (type === 'team_chat_stream_end') {
                 // --- DEBUG LOG ---
                 console.log(`[ChatService.processWebSocketMessage] Handling END for sender: ${sender}`);
                 const currentState = store.get(targetAtom);
                 console.log(`[ChatService.processWebSocketMessage] State BEFORE END update for ${team}:`, currentState);
                 store.set(targetAtom, (prev) => prev.map((msg, index) =>
                    (index === prev.length - 1 && msg.sender === sender && !msg.isComplete)
                        ? { ...msg, isComplete: true } : msg
                ));
                 const newState = store.get(targetAtom);
                 console.log(`[ChatService.processWebSocketMessage] State AFTER END update for ${team}:`, newState);
                 // ---
            }
        } catch (error: any) {
             // --- FIX: Linter error - correct addDebugMessage signature ---
             addDebugMessage(`[ChatService Error] Failed processing WS message type ${type}: ${error?.message || error}`);
             console.error('[ChatService] Error processing WS message:', error, wsMessage); // Also log to console
        }

        const targetMessages = store.get(targetAtom);
        const needsUpdate = targetMessages.length !== store.get(targetAtom).length;

        if (needsUpdate) {
            if (team === 'blue') {
                this.blueMessages = targetMessages;
                 console.log(`[ChatService.processWebSocketMessage] Calling blue callback with ${this.blueMessages.length} messages.`);
                this.onBlueMessagesUpdate?.([...this.blueMessages]); // Explicitly create a new array copy
            } else {
                this.redMessages = targetMessages;
                 console.log(`[ChatService.processWebSocketMessage] Calling red callback with ${this.redMessages.length} messages.`);
                this.onRedMessagesUpdate?.([...this.redMessages]); // Explicitly create a new array copy
            }
        }
    }

     /** Clears messages for a specific team */
     public clearTeamMessages(team: 'red' | 'blue'): void {
         addDebugMessage(`[ChatService] Clearing messages for Team ${team}`);
         const store = getChatStore(); // Get the shared store instance
         if (team === 'blue') {
             store.set(blueTeamMessagesAtom, []);
             this.blueMessages = [];
              console.log(`[ChatService.clearTeamMessages] Calling blue callback with 0 messages.`);
             this.onBlueMessagesUpdate?.([...this.blueMessages]); // Explicit copy (of empty array)
         } else {
             store.set(redTeamMessagesAtom, []);
             this.redMessages = [];
              console.log(`[ChatService.clearTeamMessages] Calling red callback with 0 messages.`);
             this.onRedMessagesUpdate?.([...this.redMessages]); // Explicit copy
         }
     }

}

// Export a singleton instance
export const chatService = new ChatServiceController();
