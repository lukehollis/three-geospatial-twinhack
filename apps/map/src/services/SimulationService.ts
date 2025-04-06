import { atom, createStore } from 'jotai';
import { CookieService } from './CookieService';
import { addDebugMessage, debugMessagesAtom } from '../components/InfoPanel'; // Import debug tools

// Define atoms WITHOUT direct export here
const webSocketStatusAtom = atom<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');

// Define a more structured type for GeoJSON data state if needed
export interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: string; // e.g., "Point", "LineString"
    coordinates: any; // number[] | number[][] etc.
  };
  properties: Record<string, any>;
}

export interface GeoJsonState {
  feature: GeoJsonFeature | null;
  // Add other relevant fields if received from backend
  // e.g., timestamp, source, etc.
}
// Define atom WITHOUT direct export here
const geojsonDataAtom = atom<GeoJsonState | null>(null);

// Define the destination interface
export interface Destination {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
}

// Update Actor to use Destination
export interface Actor {
  id: string;
  name: string;
  type: string;
  description?: string;
  initialPosition?: number[];
}

export interface Simulation {
  id: string;
  slug: string;
  name: string;
  description?: string;
  actors: Actor[];
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isReset?: boolean;
  elapsedTime: number;
  speedMultiplier: number;
}

// Update WebSocketMessage to include new analysis types if needed, or use generic 'data'
// Example: Add specific analysis types
export interface WebSocketMessage {
  type: string;
  location?: string;
  coordinates?: number[];
  error?: string;
  simulation_id?: string;
  simulation_name?: string;
  simulation_slug?: string;
  thinking?: string; // Could be used by analysis_thinking_delta?
  text?: string;     // Could be used by analysis_text_delta?
  content?: string; // General content field
  matrix_cell?: string; // For analysis_matrix_update
  final_matrix_cell?: string; // For analysis_complete
  data?: any;
  status?: 'connected' | 'disconnected' | 'connecting' | 'error';
  message?: string;
  timestamp?: number;
  request_id?: string; // Consider adding request_id for correlation
  actor_ids?: string[]; // Added for simulation_saved
  actor?: any; // Added for actor_updated
}

// Helper type for callbacks
interface RequestCallbacks {
    callback: (event: WebSocketMessage) => void;
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
}

// --- NEW: Define interface outside the class ---
interface SimulationSaveResult {
    simulation_id: string;
    simulation_slug: string;
    actor_ids?: string[]; // Keep this if needed by frontend immediately after initial save
}

export const initialPlaybackState = {
  isPlaying: false,
  isPaused: false,
  isReset: false,
  elapsedTime: 0,
  speedMultiplier: 1
};

// Define atoms for storing simulation state
export const initialSimulationState = {
  isPlaying: false,
  isPaused: false,
  elapsedTime: 0,
  speedMultiplier: 1
};


const simulationStateAtom = atom<typeof initialSimulationState>(initialSimulationState); // Keep internal for now

// Define actor models mapping
export const VEHICLE_MODELS: Record<string, string> = {
  'truck': 'truck.glb',
  'car': 'car-passenger.glb',
  'sports car': 'car-sports.glb',
  'police car': 'car-police.glb',
  'taxi': 'car-taxi.glb',
  'bus': 'bus-passenger.glb',
  'plane': 'plane-passenger.glb',
  'ship': 'ship-cargo.glb',
  'fishing boat': 'boat-fishing.glb',
  'sailboat': 'boat-sail.glb',
  'yacht': 'ship-yacht.glb',
  'pirate ship': 'ship-pirate-flags.glb',
  'train': 'train-passenger.glb',
  'freight train': 'train-freight-big.glb',
  'high speed train': 'train-speed.glb',
  'submarine': 'submarine.glb',
  'jeep': 'jeep-open.glb'
};

// --- NEW: Atom to hold the last received WebSocket message ---
// Initialize with a structure that hints at expected message format
export const lastWebSocketMessageAtom = atom<any | null>(null); // Use 'any' for now, refine later if needed

// --- Create a store instance ---
const internalStore = createStore();

export class SimulationService {
  private API_URL = `${import.meta.env['VITE_API_URL']}/api/simulation`;
  // Construct WS URL correctly based on the API URL's protocol
  private WS_URL = (() => {
    const apiUrl = import.meta.env['VITE_API_URL'] || '';
    const wsProtocol = apiUrl.startsWith('https:') ? 'wss://' : 'ws://';
    // Extract hostname and port, remove '/api/simulation' or similar if present
    const domain = apiUrl.replace(/^https?:\/\//, '').split('/')[0]; 
    return `${wsProtocol}${domain}/ws`; // Append the correct path
  })();
  
  // The current simulation and playback state
  private currentSimulation: Simulation | null = null;
  private playbackState: PlaybackState = { ...initialPlaybackState };
  private listeners: Array<(event?: any) => void> = [];
  
  // WebSocket instance - manage a single connection if possible
  private webSocket: WebSocket | null = null;
  private connectionPromise: Promise<WebSocket> | null = null;
  private messageQueue: string[] = []; // Queue messages if WS not ready
  
  // Store for active request callbacks (build, analysis, etc.)
  // Use a map if handling multiple concurrent requests of different types
  private activeRequestCallbacks: {
      build?: RequestCallbacks & { savedResult?: SimulationSaveResult }; // Add savedResult to store intermediate data
      analysis?: RequestCallbacks;
  } = {};
  
  constructor() {
    // Get userId from cookie service - no more race conditions from localStorage
    CookieService.getOrCreateAnonymousId();
    // Bind methods
    this.connectWebSocket = this.connectWebSocket.bind(this);
    this.handleWsMessage = this.handleWsMessage.bind(this);
    this._scheduleReconnect = this._scheduleReconnect.bind(this);
    this.sendRawWebSocketMessage = this.sendRawWebSocketMessage.bind(this); // Bind new public method
    // ... other necessary bindings ...
    this.streamSimulationPrompt = this.streamSimulationPrompt.bind(this);
    this.streamAnalysis = this.streamAnalysis.bind(this);
    this.loadSimulation = this.loadSimulation.bind(this);
  }

  // Get the current user ID
  getUserId(): string {
    return CookieService.getOrCreateAnonymousId();
  }

  // Generate a user ID if needed
  generateUserIdIfNeeded(): void {
    CookieService.getOrCreateAnonymousId();
  }

  // Save simulation to API
  async saveSimulation(simulation: any): Promise<string> {
    const currentUserId = this.getUserId();
    // If direct saving is still needed:
    // const response = await fetch(`${this.API_URL}/`, { method: 'POST', ... });
    // return await response.json();
    return Promise.resolve('save-via-ws'); // Placeholder
  }

  // Load simulation from API
  async loadSimulation(id: string): Promise<Simulation | null> {
    try {
      const currentUserId = this.getUserId();
      const response = await fetch(`${this.API_URL}/${id}/?anon_user_id=${encodeURIComponent(currentUserId)}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Set as current simulation and reset playback
      this.setSimulation(data);
      return data;
    } catch (error) {
      return null;
    }
  }
  
  // Get the current simulation
  getSimulation(): Simulation | null {
    return this.currentSimulation;
  }
  
  // Set the current simulation
  setSimulation(simulation: Simulation | null): void {
    this.currentSimulation = simulation;
    this.resetPlayback();
    this.notifyListeners();
  }
  
  // Get the current playback state
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }
  
  // Playback controls
  play(): void {
    this.playbackState.isPlaying = true;
    this.playbackState.isPaused = false;
    this.notifyListeners();
  }
  
  // Update pause method to ensure markers stay visible
  pause(): void {
    this.playbackState.isPlaying = false;
    this.playbackState.isPaused = true;
    this.playbackState.isReset = false; // Not a reset
    // Use a small delay to update UI to prevent flickering
    setTimeout(() => {
      this.notifyListeners();
    }, 10);
  }
  
  stop(): void {
    this.resetPlayback();
    this.notifyListeners();
  }
  
  updateElapsedTime(time: number): void {
    this.playbackState.elapsedTime = time;
    this.notifyListeners();
  }
  
  setSpeed(speed: number): void {
    this.playbackState.speedMultiplier = speed;
    this.notifyListeners();
  }
  
  resetPlayback(): void {
    this.playbackState = {
      isPlaying: false,
      isPaused: true,
      isReset: true,
      elapsedTime: 0,
      speedMultiplier: this.playbackState.speedMultiplier
    };
  }
  
  // Reset simulation including markers and routes
  resetSimulation(): void {
    
    // Reset playback state with explicit isPaused flag
    this.resetPlayback();
    
    // Notify listeners with reset event
    this.notifyListeners();
  }
  
  // Update the notifyListeners to accept an event object
  private notifyListeners(event?: any): void {
    this.listeners.forEach(listener => listener(event));
  }

  // Update subscribe method to pass the event to listeners
  subscribe(listener: (event?: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // List user's simulations
  async listUserSimulations(): Promise<any[]> {
    try {
      const currentUserId = this.getUserId();
      
      
      // Go back to using query parameters instead of custom headers
      // This matches your current backend implementation
      const response = await fetch(`${this.API_URL}/?anon_user_id=${encodeURIComponent(currentUserId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return the simulations array from the response (adjust based on your API response structure)
      return Array.isArray(data) ? data : (data.simulations || []);
    } catch (error) {
      return [];
    }
  }

  // Delete a single simulation
  async deleteSingleSimulation(id: string): Promise<boolean> {
    try {
      const currentUserId = this.getUserId();
      
      // Send delete request to API
      const response = await fetch(`${this.API_URL}/${id}/?anon_user_id=${encodeURIComponent(currentUserId)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // --- Refactored Streaming Logic ---

  private async streamRequest(
      requestType: 'build' | 'analysis', // Remove 'actor_build'
      payload: object,
      callback: (event: WebSocketMessage) => void
  ): Promise<any> {

      if (this.activeRequestCallbacks[requestType]) {
          const errorMsg = `Another ${requestType} request is already in progress.`;
          callback({ type: 'error', error: errorMsg });
          return Promise.reject(new Error(errorMsg));
      }

      const currentUserId = this.getUserId();

      return new Promise(async (resolve, reject) => {
          try {
              const ws = await this.connectWebSocket();

              this.activeRequestCallbacks[requestType] = {
                  callback,
                  resolve: resolve as (value?: any) => void,
                  reject: reject as (reason?: any) => void,
                  ...(requestType === 'build' && { savedResult: undefined }) // Initialize savedResult for build
              };

              const messageHandler = (event: MessageEvent) => {
                  try {
                      const messageData = JSON.parse(event.data) as WebSocketMessage;
                      const currentCallbacks = this.activeRequestCallbacks[requestType];

                      if (!currentCallbacks) {
                          return;
                      }

                      let relevantCallback: ((event: WebSocketMessage) => void) | undefined;

                      // --- Message Routing ---
                      if (requestType === 'build') {
                          // Build now includes actor build events
                          const types = [
                              'start', 'text_delta', 'build_thinking_delta',
                              'location_extracted', 'coordinates_found',
                              'simulation_saved', // Still pass this to callback
                              'build_actors_started', // Keep this
                              'error', 'build_actors_complete' // Final completion event for build
                          ];
                          if (types.includes(messageData.type)) relevantCallback = currentCallbacks.callback;
                      } else if (requestType === 'analysis') {
                          const types = [
                              'analysis_started', 'analysis_text_delta', 'analysis_thinking_delta',
                              'analysis_matrix_update', 'error', 'analysis_complete'
                          ];
                          if (types.includes(messageData.type)) relevantCallback = currentCallbacks.callback;
                      }

                      // --- Invoke Callback & Logging ---
                      if (relevantCallback) {
                          relevantCallback(messageData);
                          // Simplified Logging (keep existing logic)
                          if (messageData.type === 'text_delta' && messageData.text != null) addDebugMessage(String(messageData.text));
                          else if (messageData.type === 'build_thinking_delta' && messageData.content != null) addDebugMessage(String(messageData.content));
                          else if (messageData.type === 'analysis_text_delta' && messageData.content != null) addDebugMessage(String(messageData.content));
                          else if (messageData.type === 'analysis_thinking_delta' && messageData.content != null) addDebugMessage(String(messageData.content));

                      }


                      // --- Handle Completion & Errors ---
                      if (messageData.type === 'error') {
                          addDebugMessage(`ERROR: ${String(messageData.error || 'Unknown error')}`);
                          const rejectReason = new Error(String(messageData.error || `Unknown error during ${requestType}`));
                          // Reject FIRST, then cleanup
                          currentCallbacks.reject(rejectReason);
                          this.cleanupRequest(requestType, ws, messageHandler, closeHandler);


                      } else if (requestType === 'build' && messageData.type === 'simulation_saved') {
                          // Store data needed for promise resolution
                          if (currentCallbacks && currentCallbacks.savedResult === undefined) { // Added check for currentCallbacks
                              currentCallbacks.savedResult = {
                                  simulation_id: messageData.simulation_id!,
                                  simulation_slug: messageData.simulation_slug!,
                                  actor_ids: messageData.actor_ids
                              };
                          }
                           // Callback invoked above if relevant

                      } else if (requestType === 'analysis' && messageData.type === 'analysis_complete') {
                          addDebugMessage(`COMPLETE: analysis`);
                          const resultData = messageData.final_matrix_cell; // Example: analysis might resolve with data
                          // Resolve FIRST, then cleanup
                          currentCallbacks.resolve(resultData);
                          this.cleanupRequest(requestType, ws, messageHandler, closeHandler);


                      } else if (requestType === 'build' && messageData.type === 'build_actors_complete') {
                          addDebugMessage(`COMPLETE: build (actors finished)`);
                          // If 'simulation_saved' was missed, resolve with empty object or handle error
                          const resultData = currentCallbacks.savedResult ?? { simulation_id: messageData.simulation_id, simulation_slug: null };
                           // Resolve FIRST, then cleanup
                          currentCallbacks.resolve(resultData);
                          this.cleanupRequest(requestType, ws, messageHandler, closeHandler);
                      }

                  } catch (err) {
                      addDebugMessage(`PARSE_ERROR: ${String(event.data).substring(0, 100)}...`);
                      const currentCallbacks = this.activeRequestCallbacks[requestType];
                      if (currentCallbacks) {
                          // Ensure cleanup happens *before* rejecting
                          const rejectReason = new Error('Failed to parse WebSocket message');
                          this.cleanupRequest(requestType, ws, messageHandler, closeHandler);
                          currentCallbacks.reject(rejectReason); // Reject *after* cleanup
                      }
                  }
              };

              const closeHandler = (event: CloseEvent) => {
                  const currentCallbacks = this.activeRequestCallbacks[requestType];
                  if (currentCallbacks) {
                       // Only reject if the request hasn't already completed or errored
                       if (currentCallbacks.reject) {
                           currentCallbacks.reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
                       }
                      this.cleanupRequest(requestType, ws, messageHandler, closeHandler); // Ensure cleanup
                  }
              };

              ws.addEventListener('message', messageHandler);
              ws.addEventListener('close', closeHandler);

              // Send the initial message to start the process
              await this.sendRawWebSocketMessage({
                  ...payload,
                  anon_user_id: currentUserId,
              });

          } catch (error) {
               this.cleanupRequest(requestType, null, () => {}, () => {}); // Attempt cleanup
               reject(error); // Reject the main promise
          }
      });
  }

   // Helper to cleanup listeners and state
   private cleanupRequest(
       requestType: 'build' | 'analysis', // Remove 'actor_build'
       ws: WebSocket | null,
       messageHandler: (event: MessageEvent) => void,
       closeHandler: (event: CloseEvent) => void
   ): void {
       ws?.removeEventListener('message', messageHandler);
       ws?.removeEventListener('close', closeHandler);
       if (requestType in this.activeRequestCallbacks) {
          // Clear resolve/reject to prevent accidental calls after cleanup
          if(this.activeRequestCallbacks[requestType]) {
             // @ts-ignore - Allow deleting potentially undefined properties cleanly
             delete this.activeRequestCallbacks[requestType]?.resolve;
             // @ts-ignore
             delete this.activeRequestCallbacks[requestType]?.reject;
          }
          this.activeRequestCallbacks[requestType] = undefined;
       }
   }


  // --- Specific Stream Methods ---

  async streamSimulationPrompt(data: { prompt: string }, callback: (event: WebSocketMessage) => void): Promise<SimulationSaveResult> {
      const payload = {
          type: 'build_simulation', // This type now triggers the full build on backend
          prompt: data.prompt,
      };
      // The promise now resolves after 'build_actors_complete' with the initial save data
      return this.streamRequest('build', payload, callback) as Promise<SimulationSaveResult>;
  }

  async streamAnalysis(simulationId: string, callback: (event: WebSocketMessage) => void): Promise<any> { // Return type might be specific (e.g., string for matrix cell)
       const payload = {
           type: 'analyze_simulation_risks',
           simulation_id: simulationId,
       };
       // Promise resolves on 'analysis_complete'
       return this.streamRequest('analysis', payload, callback);
   }

  // --- WebSocket Management (connectWebSocket, sendWebSocketMessage) ---
   private connectWebSocket(): Promise<WebSocket> {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            return Promise.resolve(this.webSocket);
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                // --- FIX: Use internalStore ---
                internalStore.set(webSocketStatusAtom, 'connecting');
                addDebugMessage(`[WS] Attempting to connect to ${this.WS_URL}...`);
                this.webSocket = new WebSocket(this.WS_URL);

                this.webSocket.onopen = () => {
                    addDebugMessage('[WS] Connection opened.');
                    // --- FIX: Use internalStore ---
                    internalStore.set(webSocketStatusAtom, 'connected');
                    this.reconnectAttempts = 0;
                    this.connectionPromise = null;
                    while (this.messageQueue.length > 0) {
                        const msg = this.messageQueue.shift();
                        if (msg) {
                           this.webSocket?.send(msg);
                        }
                    }
                    resolve(this.webSocket as WebSocket);
                };
                this.webSocket.onclose = (event: CloseEvent) => {
                     addDebugMessage(`[WS] Connection closed. Code: ${event.code}`, event);
                     // --- FIX: Use internalStore ---
                     const wasConnected = internalStore.get(webSocketStatusAtom) === 'connected';
                     internalStore.set(webSocketStatusAtom, 'disconnected');
                     this.webSocket = null;
                     this.connectionPromise = null;
                     // ... (reject pending requests - remains same) ...
                     Object.entries(this.activeRequestCallbacks).forEach(([type, callbacks]) => {
                         if (callbacks && callbacks.reject) {
                              callbacks.reject(new Error(`WebSocket closed: ${event.code}`));
                              this.cleanupRequest(type as 'build' | 'analysis', null, undefined, undefined);
                         }
                     });

                     if (wasConnected || !event.wasClean) this._scheduleReconnect();
                 };
                this.webSocket.onerror = (error: Event) => {
                    addDebugMessage('[WS] Connection error.', error);
                     // --- FIX: Use internalStore ---
                    internalStore.set(webSocketStatusAtom, 'error');
                    // ... (reject pending requests - remains same) ...
                     Object.entries(this.activeRequestCallbacks).forEach(([type, callbacks]) => {
                         if (callbacks && callbacks.reject) {
                              callbacks.reject(new Error('WebSocket connection error'));
                              this.cleanupRequest(type as 'build' | 'analysis', null, undefined, undefined);
                         }
                     });
                    if (this.connectionPromise) { /* ... reject connection promise ... */
                        reject(new Error('WebSocket connection failed'));
                        this.connectionPromise = null;
                     }
                     // Close event likely follows, triggering reconnect there if needed
                };
                 this.webSocket.onmessage = this.handleWsMessage; // Central message handler

            } catch (error: any) {
                 addDebugMessage(`[WS] Connection init error: ${error.message}`);
                 // --- FIX: Use internalStore ---
                 internalStore.set(webSocketStatusAtom, 'error');
                 this.connectionPromise = null;
                 reject(error);
            }
        });
        return this.connectionPromise;
    }

    // --- NEW: Public method for sending raw messages ---
    /**
     * Sends a message object over the WebSocket connection, queueing if necessary.
     * Use with caution; prefer dedicated service methods (stream*, etc.) where possible.
     * @param message The message object to send (must be JSON-serializable).
     */
    public async sendRawWebSocketMessage(message: object): Promise<void> {
        const messageString = JSON.stringify(message);
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(messageString);
            // addDebugMessage(`[WS Sent Raw] Type: ${(message as any).type}`); // Optional logging
        } else {
             addDebugMessage(`[WS] Queuing raw message: Type: ${(message as any).type}`);
             this.messageQueue.push(messageString);
             try {
                 await this.connectWebSocket(); // Ensure connection attempt
             } catch (error: any) {
                  addDebugMessage(`[WS Error] Failed connection attempt while queuing raw message: ${error.message}`);
             }
        }
    }
    // --- END NEW ---

    private handleWsMessage(event: MessageEvent): void { // Central handler
        try {
            const messageData = JSON.parse(event.data) as WebSocketMessage;
            // Log non-delta messages
            // if (!messageData.type?.includes('delta')) addDebugMessage(`[WS Recv] Type: ${messageData.type}`, messageData);

            // --- Update the global message atom ---
            // --- FIX: Use internalStore ---
            internalStore.set(lastWebSocketMessageAtom, { ...messageData, receivedAt: Date.now() });
            // --- ---

            // --- Global State Updates (simulation_saved, actor_updated) ---
            // This logic needs to be robust and likely only update if NOT part of an active request
             const isHandledByActiveRequest =
                (this.activeRequestCallbacks.build && ['start', 'text_delta', /* etc */].includes(messageData.type)) ||
                (this.activeRequestCallbacks.analysis && ['analysis_started', /* etc */].includes(messageData.type));

             if (messageData.type === 'simulation_saved' && !this.activeRequestCallbacks.build) {
                 // ... (logic to update this.currentSimulation as before) ...
             } else if (messageData.type === 'actor_updated' && !this.activeRequestCallbacks.build) {
                 // ... (logic to update this.currentSimulation.actors as before) ...
             }
            // --- End Global State Updates ---

             // Specific request messages are handled within streamRequest's handler

        } catch(e: any) {
           addDebugMessage(`[WS Parse Error] ${event.data}: ${e.message}`);
           console.error("WS message parse error", e);
        }
    }

     private _scheduleReconnect(): void {
         if (this.reconnectAttempts < this.maxReconnectAttempts) {
             this.reconnectAttempts++;
             const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
             addDebugMessage(`[WS] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay / 1000}s...`);
             setTimeout(() => {
                 // --- FIX: Use internalStore ---
                 if (internalStore.get(webSocketStatusAtom) === 'disconnected') {
                     addDebugMessage('[WS] Attempting reconnect...');
                     this.connectWebSocket().catch(err => { /* ... log error ... */ });
                 } else {
                     addDebugMessage('[WS] Reconnect cancelled, already connected/connecting.');
                     this.reconnectAttempts = 0;
                 }
             }, delay);
         } else {
             addDebugMessage('[WS] Max reconnect attempts reached.');
             // --- FIX: Use internalStore ---
             internalStore.set(webSocketStatusAtom, 'disconnected');
         }
     }

} // End of SimulationService class

export const simulationService = new SimulationService();

// Expose atoms for components to use
export { geojsonDataAtom, webSocketStatusAtom, simulationStateAtom };
