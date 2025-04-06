import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { css } from '@emotion/react';
import { useParams } from 'react-router';
import { addDebugMessage } from './InfoPanel'; // Import this to log to info panel
import { simulationService, WebSocketMessage } from '../services/SimulationService';

interface RouteAnalysisProps {
  googleMapRef: React.RefObject<google.maps.Map>;
  infoWindowRef: React.RefObject<google.maps.InfoWindow>;
}

interface EventData {
  type: 'thinking' | 'text' | 'matrix_update' | 'matrix_selection';
  content?: string;
  matrix_cell?: string;
  explanation?: string;
}

interface MatrixSelectionResponse {
  risk_threat_matrix_selection: string;
}

const SimulationAnalysis: React.FC<RouteAnalysisProps> = ({ googleMapRef, infoWindowRef }) => {
  const { id } = useParams<{ id: string }>(); // Get simulation ID from URL params
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [analysisResults, setAnalysisResults] = useState<string>('');
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isAnalyzingRef = useRef<boolean>(false); // Ref to track analysis state

  // Function to handle route selection
  const handleRouteSelect = (route: any): void => {
    setSelectedRoute(route);
  };

  // Function to handle matrix cell updates
  const handleMatrixCellUpdate = (cellId: string): void => {
    // Find the cell element and highlight it
    const cell = document.querySelector(`[data-cell="${cellId}"]`);
    if (cell) {
      // Add a pulsing animation or highlight
      cell.classList.add('bg-blue-400');
      cell.classList.add('animate-pulse');
      
      // Remove the animation after a delay
      setTimeout(() => {
        cell.classList.remove('animate-pulse');
      }, 2000);
    }
  };
  
  // Function to handle matrix selection events
  const handleMatrixSelection = (cellId: string, explanation?: string): void => {
    // First, reset all cells to their original state
    document.querySelectorAll('.matrix-cell').forEach((cell) => {
      // Remove any previous selection styling
      cell.classList.remove('ring-4');
      cell.classList.remove('ring-white');
      cell.classList.remove('ring-offset-2');
      cell.classList.remove('ring-offset-slate-900');
      cell.classList.remove('shadow-lg');
      cell.classList.remove('shadow-white/30');
      cell.classList.remove('font-bold');
      cell.classList.remove('text-lg');
      cell.classList.remove('scale-110');
      cell.classList.remove('z-10');
    });
    
    // Find the cell element and apply the selection styling
    const cell = document.querySelector(`[data-cell="${cellId}"]`);
    if (cell) {
      // Add a prominent selection styling with white box highlight
      cell.classList.add('ring-4');
      cell.classList.add('ring-white');
      cell.classList.add('ring-offset-2');
      cell.classList.add('ring-offset-slate-900');
      cell.classList.add('shadow-lg');
      cell.classList.add('shadow-white/30');
      cell.classList.add('font-bold');
      cell.classList.add('text-lg');
      cell.classList.add('scale-110'); // Slightly enlarge the selected cell
      cell.classList.add('z-10'); // Ensure it appears above other cells
      
      // Scroll to make sure the matrix is visible
      const matrix = document.getElementById('risk-matrix');
      if (matrix) {
        matrix.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Cleanup function for the EventSource
  const cleanupEventSource = (): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // Clean up the EventSource when component unmounts
  useEffect(() => {
    return () => cleanupEventSource();
  }, []);

  // Define the callback for handling WebSocket messages during analysis
  const handleAnalysisEvent = useCallback((event: WebSocketMessage): void => {
      addDebugMessage(`WS Analysis Event: ${event.type} - ${JSON.stringify(event.content ?? event.message ?? event.error ?? event.matrix_cell).substring(0,100)}`);

      switch (event.type) {
          case 'analysis_started':
              setLoading(true); // Ensure loading is true
              break;

          case 'analysis_thinking_delta':
              if (event.content) {
                  setThinkingContent(prev => prev + event.content);
              }
              break;

          case 'analysis_text_delta':
              if (event.content) {
                  setAnalysisResults(prev => prev + event.content);
              }
              break;

          case 'analysis_matrix_update':
              if (event.matrix_cell) {
                  handleMatrixCellUpdate(event.matrix_cell);
                  addDebugMessage(`Matrix update: ${event.matrix_cell}`);
              }
               // Optionally append content that triggered the update to results
               if (event.content) {
                   setAnalysisResults(prev => prev + event.content);
               }
              break;

          case 'analysis_complete':
              setLoading(false);
              isAnalyzingRef.current = false; // Mark analysis as finished
              addDebugMessage(`Analysis complete. Final Matrix: ${event.final_matrix_cell}`);
              if (event.final_matrix_cell) {
                  // Apply permanent selection to the final cell
                  handleMatrixSelection(event.final_matrix_cell, 'Final Assessment');
              }
              // Append completion message
               setAnalysisResults(prev => prev + '\n\n' + (event.message || 'Analysis complete.'));
              break;

          case 'error':
              setLoading(false);
              isAnalyzingRef.current = false; // Mark analysis as finished on error
              console.error('Analysis WebSocket Error:', event.error);
              addDebugMessage(`Analysis Error: ${event.error}`);
              setAnalysisResults(prev => prev + `\n\n**Error during analysis:** ${event.error}`);
              break;

          default:
              console.log('Unknown analysis event type:', event.type);
              addDebugMessage(`Unknown analysis event: ${event.type}`);
      }
  }, [handleMatrixCellUpdate, handleMatrixSelection]); // Dependencies for useCallback

  // Function to analyze the selected route
  const analyzeRoute = (): void => {
    if (isAnalyzingRef.current) {
        addDebugMessage("Analysis already in progress.");
        console.warn("Analysis already in progress.");
        return; // Don't start multiple analyses
    }

    if (!id) {
      console.error('No simulation ID found in URL.');
      addDebugMessage('Error: No simulation ID found in URL for analysis.');
      return;
    }

    // Reset states
    setLoading(true);
    setAnalysisResults(''); // Clear previous results
    setThinkingContent(''); // Clear previous thinking
    setShowResults(true);
    isAnalyzingRef.current = true; // Mark analysis as started

    addDebugMessage(`Requesting analysis via WS for simulation: ${id}`);

    // Call the simulation service to start streaming analysis
    simulationService.streamAnalysis(id, handleAnalysisEvent)
      .then(() => {
        // Promise resolves on 'analysis_complete'
        addDebugMessage("Analysis stream completed successfully.");
        // setLoading(false); // Already handled by 'analysis_complete' event
        // isAnalyzingRef.current = false; // Already handled by 'analysis_complete' event
      })
      .catch((error) => {
        // Promise rejects on error or unexpected close
        setLoading(false);
        isAnalyzingRef.current = false; // Ensure flag is reset on error catch
        console.error('Error initiating analysis stream:', error);
        addDebugMessage(`Error starting analysis stream: ${error.message}`);
        setAnalysisResults(prev => prev + `\n\n**Failed to start analysis:** ${error.message}`);
      });
  };

  // Cleanup potentially running analysis if component unmounts
  useEffect(() => {
       return () => {
           if (isAnalyzingRef.current) {
               addDebugMessage("Component unmounting, analysis might be ongoing.");
               // Consider adding logic to SimulationService to cancel/cleanup ongoing requests if needed
               // simulationService.cancelAnalysis(); // Example hypothetical cancellation
               isAnalyzingRef.current = false;
           }
       };
   }, []);

  return (
    <div className="overflow-y-auto">
      {showResults && (
        <div id="risk-matrix" className="border-gray-700">
          <h4 className="font-medium text-yellow-400 mb-2">Risk Assessment Matrix</h4>
          <div className="text-xs mb-2">
          <span className="mr-3"><span className="text-red-500 font-bold">E</span> = Extremely High</span>
          <span className="mr-3"><span className="text-orange-500 font-bold">H</span> = High</span>
          <span className="mr-3"><span className="text-yellow-500 font-bold">M</span> = Moderate</span>
          <span><span className="text-green-500 font-bold">L</span> = Low</span>
        </div>
        <div 
          className="grid gap-px bg-slate-700 text-center text-xs relative" 
          style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(5, minmax(50px, 1fr))' }}
        >
          <div className="bg-slate-900 p-1 font-bold"></div>
          <div className="bg-slate-900 p-1 font-bold col-span-5">PROBABILITY</div>
          <div className="bg-slate-900 p-1 font-bold">SEVERITY</div>
          <div className="bg-slate-900 p-1" style={{fontSize: '10px'}}>Frequent<br/>A</div>
          <div className="bg-slate-900 p-1" style={{fontSize: '10px'}}>Likely<br/>B</div>
          <div className="bg-slate-900 p-1" style={{fontSize: '10px'}}>Occasional<br/>C</div>
          <div className="bg-slate-900 p-1" style={{fontSize: '10px'}}>Seldom<br/>D</div>
          <div className="bg-slate-900 p-1" style={{fontSize: '10px'}}>Unlikely<br/>E</div>
          <div className="bg-slate-900 p-1 text-left pl-2" style={{fontSize: '10px'}}>Catastrophic<br/>I</div>
          <div className="bg-teal-800 p-1 matrix-cell" data-cell="IA">E</div>
          <div className="bg-teal-800 p-1 matrix-cell" data-cell="IB">E</div>
          <div className="bg-orange-700 p-1 matrix-cell" data-cell="IC">H</div>
          <div className="bg-orange-700 p-1 matrix-cell" data-cell="ID">H</div>
          <div className="bg-yellow-500 p-1 matrix-cell" data-cell="IE">M</div>
          <div className="bg-slate-900 p-1 text-left pl-2" style={{fontSize: '10px'}}>Critical<br/>II</div>
          <div className="bg-teal-800 p-1 matrix-cell" data-cell="IIA">E</div>
          <div className="bg-orange-700 p-1 matrix-cell" data-cell="IIB">H</div>
          <div className="bg-orange-700 p-1 matrix-cell" data-cell="IIC">H</div>
          <div className="bg-yellow-500 p-1 matrix-cell" data-cell="IID">M</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IIE">L</div>
          <div className="bg-slate-900 p-1 text-left pl-2" style={{fontSize: '10px'}}>Marginal<br/>III</div>
          <div className="bg-orange-700 p-1 matrix-cell" data-cell="IIIA">H</div>
          <div className="bg-yellow-500 p-1 matrix-cell" data-cell="IIIB">M</div>
          <div className="bg-yellow-500 p-1 matrix-cell" data-cell="IIIC">M</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IIID">L</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IIIE">L</div>
          <div className="bg-slate-900 p-1 text-left pl-2" style={{fontSize: '10px'}}>Negligible<br/>IV</div>
          <div className="bg-yellow-500 p-1 matrix-cell" data-cell="IVA">M</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IVB">L</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IVC">L</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IVD">L</div>
          <div className="bg-green-500 p-1 matrix-cell" data-cell="IVE">L</div>
        </div>
      </div>
      )}
      {/* Analysis Results Section */}
      {showResults && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Analysis Results</h3>
          
          {/* Thinking Process - displayed with opacity-60 and smaller text */}
          {thinkingContent && (
            <div className="mb-4 p-3 bg-slate-800 rounded opacity-60 text-xs whitespace-pre-wrap overflow-auto max-h-[200px] " style={{ display: 'none'}}>
              <h4 className="font-semibold mb-1">Thinking Process:</h4>
              {thinkingContent}
            </div>
          )}
          
          {/* Analysis Text - displayed with full opacity and normal text size */}
          {analysisResults && (
            <div className="p-3 bg-slate-800 rounded text-sm overflow-auto max-h-[300px]">
              <h4 className="font-semibold mb-1">Analysis:</h4>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{analysisResults}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-700 flex justify-center">
        <button 
          onClick={analyzeRoute}
          css={analyzeButtonStyle}
        >
          {loading ? 'Thinking...' : 'Analyze'}
        </button>
      </div>
    </div>
  );
};

const analyzeButtonStyle = css`
    background-color: rgba(40, 45, 50, 0.7);
    width: 100%;
    color: #fff;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 0.1em;
    transition: background-color 0.3s ease;
    height: auto;
    
    &:hover {
      background-color: rgba(40, 45, 50, 0.9);
    }
`;

export default SimulationAnalysis;
