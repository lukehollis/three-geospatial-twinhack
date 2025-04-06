import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { TextArea, Button, Icon, Spinner, Checkbox } from '@blueprintjs/core';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import { atom, useAtom } from 'jotai';
import { SimulationService, StreamEvent } from '../services/SimulationService';
import { addDebugMessage } from './InfoPanel';
import { useNavigate } from 'react-router';

// Create atoms for storing data that can be accessed by other components
export const processingPromptAtom = atom<boolean>(false);

// Add atom for simulation text input
export const simulationTextInputAtom = atom<string>('');


interface CreatorToolContainerProps {
  onSubmit?: (text: string) => void;
  isHidden?: boolean;
}

interface SuggestionProps {
  title: string;
  subtitle: string;
  onClick: () => void;
}

const Suggestion: React.FC<SuggestionProps> = ({ title, subtitle, onClick }) => {
  return (
    <div css={suggestionStyle} onClick={onClick}>
      <div css={suggestionTextStyle}>
        <div css={titleStyle}>{title}</div>
        <div css={subtitleStyle}>{subtitle}</div>
      </div>
    </div>
  );
};

export const CreatorToolContainer: React.FC<CreatorToolContainerProps> = (props) => {
  const [textInput, setTextInput] = useState('');
  const [, setSimulationText] = useAtom(simulationTextInputAtom);
  const [processing, setProcessing] = useAtom(processingPromptAtom);
  const [suggestionsVisible, setSuggestionsVisible] = useState<boolean>(true);
  const [interfaceVisible, setInterfaceVisible] = useState<boolean>(true);
  const [interfaceRendered, setInterfaceRendered] = useState<boolean>(true);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const simulationService = new SimulationService();
  
  // Handle the transition end effect to remove interface elements from DOM after fade out
  useEffect(() => {
    if (!interfaceVisible) {
      // Set a timeout to match the CSS transition duration (0.3s)
      const timer = setTimeout(() => {
        setInterfaceRendered(false);
      }, 300); // 300ms matches the transition duration
      
      return () => clearTimeout(timer);
    } else {
      setInterfaceRendered(true);
    }
  }, [interfaceVisible]);
  
  // Initialize state and check for pre-existing simulation
  useEffect(() => {
    // Don't show if isHidden is explicitly controlled through props
    if (props.isHidden !== undefined) {
      setInterfaceVisible(!props.isHidden);
      return;
    }
    
    // Otherwise default behavior is to show the interface
    setInterfaceVisible(true);
  }, [props.isHidden]);

  // Listen for hide-chat-interface and show-chat-interface events
  useEffect(() => {
    const handleHideSuggestions = () => {
      console.log('[CreatorToolContainer] Received hide-suggestions event');
      setSuggestionsVisible(false);
    };
    
    const handleShowSuggestions = () => {
      console.log('[CreatorToolContainer] Received show-suggestions event');
      setSuggestionsVisible(true);
    };
    
    const handleHideInterface = () => {
      console.log('[CreatorToolContainer] Received hide-chat-interface event');
      setInterfaceVisible(false);
    };
    
    const handleShowInterface = () => {
      console.log('[CreatorToolContainer] Received show-chat-interface event');
      setInterfaceVisible(true);
    };
    
    window.addEventListener('hide-chat-interface', handleHideInterface);
    window.addEventListener('show-chat-interface', handleShowInterface);
    window.addEventListener('hide-suggestions', handleHideSuggestions);
    window.addEventListener('show-suggestions', handleShowSuggestions);

    return () => {
      window.removeEventListener('hide-chat-interface', handleHideInterface);
      window.removeEventListener('show-chat-interface', handleShowInterface);
      window.removeEventListener('hide-suggestions', handleHideSuggestions);
      window.removeEventListener('show-suggestions', handleShowSuggestions);
    };
  }, []);

  // No toast functionality needed

  const handleSubmit = async () => {
    let navDetails: { id: string; slug: string } | null = null;

    if (textInput.trim()) {
      setSuggestionsVisible(false);

      try {
        setProcessing(true);
        setStatus('Processing prompt and generating simulation...');
        setError(null);

        await simulationService.streamSimulationPrompt(
          { prompt: textInput },
          (event: StreamEvent) => {
            console.log(`[CreatorToolContainer Callback] Received event: ${event.type}`);
            switch (event.type) {
              case 'start':
                // setStatus('Starting simulation creation...');
                addDebugMessage('Starting simulation creation...');
                break;
              case 'location_extracted':
                setStatus(`Geocoding: ${event.location}`);
                addDebugMessage(`Found location: ${event.location}`);
                break;
              case 'coordinates_found':
                addDebugMessage(`Found coordinates: ${event.coordinates?.join(', ')} for ${event.location}`);
                break;
              case 'simulation_saved':
                // setStatus(`Simulation saved (ID: ${event.simulation_id}). Building actors...`);
                addDebugMessage(`Simulation base saved: ${event.simulation_id} (${event.simulation_name}). Building actors...`);
                console.log(`[CreatorToolContainer simulation_saved] Received ID: ${event.simulation_id}, Slug: ${event.simulation_slug}`);
                const simId = event.simulation_id;
                const simSlug = event.simulation_slug;
                if (simId && simSlug) {
                   console.log(`[CreatorToolContainer simulation_saved] Storing nav details locally:`, { id: simId, slug: simSlug });
                   navDetails = { id: simId, slug: simSlug };
                } else {
                    console.error(`[CreatorToolContainer simulation_saved] Condition failed! ID: ${simId}, Slug: ${simSlug}`);
                    setError('Error receiving simulation details.');
                    setStatus('Error saving simulation base.');
                    setInterfaceVisible(true);
                }
                break;
              case 'build_actors_started':
                  // Status might be updated after navigation has already occurred,
                  // which is fine, this component might unmount soon.
                  setStatus('Building actor details...');
                  addDebugMessage('Building actor details...');
                  break;
              case 'actor_updated':
                  // This event is now primarily for the map view component,
                  // but we can still log it here if the component hasn't unmounted yet.
                  break;
              case 'build_thinking_delta':
                  // addDebugMessage(`${event.content}`);
                break;
              case 'error':
                // Handle errors that occur *before* navigation might happen
                setError(event.error || 'Unknown error during build');
                setStatus(`Error: ${event.error}`);
                addDebugMessage(`Error: ${event.error}`);
                setInterfaceVisible(true);
                break;
              case 'build_actors_complete':
                console.log('[CreatorToolContainer] build_actors_complete received.');
                console.log('[CreatorToolContainer build_actors_complete] Checking local navDetails:', navDetails);
                setStatus('Simulation build fully complete. Navigating...');
                addDebugMessage('Actor building complete on backend. Navigating...');
                if (navDetails) {
                    console.log(`[CreatorToolContainer] Navigating to /sim/${navDetails.id}/${navDetails.slug} after actors complete.`);
                    setSimulationText(textInput);
                    setTextInput('');
                    navigate(`/sim/${navDetails.id}/${navDetails.slug}`);
                } else {
                    console.error("[CreatorToolContainer] build_actors_complete received, but local navDetails are missing.");
                    setError("Failed to get simulation details for navigation after build.");
                    setStatus("Error finalizing simulation build.");
                    setInterfaceVisible(true);
                }
                break;
            }
          }
        );

        addDebugMessage('Full simulation stream processing finished on frontend.');

      } catch (err) {
        console.error('Error processing prompt:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setStatus(`Error: ${errorMessage}`);
        addDebugMessage(`Error processing prompt: ${errorMessage}`);
        setInterfaceVisible(true);
      } finally {
        setProcessing(false);
        console.log("[CreatorToolContainer] Exiting handleSubmit finally block.");
      }

      if (props.onSubmit) {
        props.onSubmit(textInput);
      }
    }
  };

  const handleSuggestionClick = (text: string) => {
    setTextInput(text);
  };

  // Example suggestions for the user
  const suggestionItems = [
    {
      title: 'Global shipping',
      subtitle: 'A containership from Shanghai to Miami',
      text: 'Add a containership sailing from Shanghai to San Francisco'
    },
    {
      title: 'Supply run',
      subtitle: 'A hackathon in SF needs supplies from SJ',
      text: 'Simulate a supply run with 4 trucks carrying coffee and pizza from San Jose to San Francisco'
    },
    {
      title: 'Cargo flight',
      subtitle: 'Global express delivery route with multiple hubs',
      text: 'Add a FedEx MD-11F cargo flight carrying express packages from Guangzhou to Anchorage to Memphis to Miami'
    },
  ];

  const showInterface = () => {
    setInterfaceVisible(true);
    setInterfaceRendered(true);
  };

  if (!interfaceRendered) {
    return (
      <div css={plusButtonContainerStyle}>
        <Button
          minimal
          icon={<Icon icon="plus" color="#fff" size={20} />}
          onClick={showInterface}
          css={plusButtonStyle}
        />
      </div>
    );
  }

  return (
    <div css={outerContainerStyle}>
      <div css={[interfaceContainerStyle, !interfaceVisible && { opacity: 0, pointerEvents: 'none' }]}>
        <div
          css={suggestionsContainerStyle}
          style={{ opacity: suggestionsVisible ? 1 : 0, pointerEvents: suggestionsVisible ? 'auto' : 'none' }}
        >
          {suggestionItems.map((suggestion, index) => (
            <Suggestion
              key={index}
              title={suggestion.title}
              subtitle={suggestion.subtitle}
              onClick={() => handleSuggestionClick(suggestion.text)}
            />
          ))}
        </div>

        <div css={textBoxContainerStyle}>
          {status && !processing && !error && <div css={statusStyle}>{status}</div>}
          {error && <div css={errorStyle}>Error: {error}</div>}

          <div css={inputContainerStyle}>
            <TextArea
              css={textBoxStyle}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={processing ? status : "What do you want to simulate?"}
              fill
              growVertically
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={processing}
            />
            <div css={buttonContainerStyle}>
              <Button
                minimal
                icon={processing ? <Spinner size={16} /> : <Icon icon="arrow-right" color="#fff" size={16} />}
                onClick={handleSubmit}
                css={sendButtonStyle}
                disabled={processing || !textInput.trim()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles using emotion css
const outerContainerStyle = css`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 720px;
  z-index: 800;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  display: none;

  @media (max-width: 760px) {
    width: auto;
    left: 8px;
    right: 8px;
    transform: translateX(0);
    max-width: none;
  }
`;

const suggestionsContainerStyle = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 10px;
  width: 100%;
  opacity: 1;
  transition: opacity 0.3s ease-out;
  
  &[data-visible='false'] {
    opacity: 0;
    pointer-events: none;
  }

  @media (max-width: 1200px) {
    justify-content: space-between;
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const suggestionStyle = css`
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  background-repeat: repeat;
  border: 1px solid #444;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1 0 calc(25% - 15px);
  min-width: 200px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 1200px) {
    flex: 1 0 calc(50% - 15px);
  }
  
  @media (max-width: 1200px) and (min-width: 769px) {
    &:nth-of-type(n+3) {
      display: none;
    }
  }
  
  &:hover {
    background-color: rgba(30, 30, 30, 0.7);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
  }
`;

const suggestionTextStyle = css`
  display: flex;
  flex-direction: column;
`;

const titleStyle = css`
  color: white;
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 2px;
`;

const subtitleStyle = css`
  color: #aaa;
  font-size: 14px;
  opacity: 0.8;
`;

const textBoxContainerStyle = css`
  width: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  background-repeat: repeat;
  border: 1px solid #444;
  padding: 8px;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
`;

const inputContainerStyle = css`
  display: flex;
  align-items: flex-end;
  width: 100%;
  min-height: 40px;
`;

const textBoxStyle = css`
  width: 100%;
  background-color: transparent;
  border: none;
  color: white;
  font-size: 14px;
  resize: none;
  box-shadow: none;
  min-height: 40px;
  max-height: 120px;
  overflow-y: auto;
  &::placeholder {
    color: #aaa;
    font-size: 14px;
  }
  .bp4-dark & {
    background-color: transparent;
  }
`;

const buttonContainerStyle = css`
  display: flex;
  align-items: flex-end;
  margin-left: 8px;
  padding-bottom: 4px;
`;

const sendButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #2965CC;
  &:hover {
    background-color: #3d78d9;
  }
`;

// Simple processing indicator style
const processingIndicatorStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 10px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  width: 32px;
`;

const checkboxContainerStyle = css`
  display: flex;
  justify-content: flex-start;
  margin-top: 8px;
  padding-left: 4px;
`;

const checkboxStyle = css`
  color: white;
  font-size: 12px;
  opacity: 0.8;
  
  .bp4-control-indicator {
    background-color: rgba(30, 30, 30, 0.7);
    border-color: #444;
  }
  
  &:hover .bp4-control-indicator {
    background-color: rgba(40, 40, 40, 0.7);
  }
`;

// Add new interfaceContainerStyle to handle the fade transition for all elements
const interfaceContainerStyle = css`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity 0.3s ease-out;
`;

// Add new styles for the plus button
const plusButtonContainerStyle = css`
  position: fixed;
  bottom: 10px;
  right: 370px;
  z-index: 800;

  @media (max-width: 1460px) {
    right: 260px;
  }

  @media (max-width: 1240px) {
    right: 200px;
  }

  @media (max-width: 1120px) {
    right: 20px;
  }
`;

const plusButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;

  background: rgba(0, 0, 0, 0.8) !important;

  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  
  &:hover {
    background: rgba(0, 0, 0, 0.9) !important;
  }
  
  .bp4-icon {
    margin: 0;
  }

`;

// Add styles for Status/Error display if needed
const statusStyle = css`
  font-size: 10px;
  color: #aaa;
  padding: 0 10px;
  text-align: left;
`;

const errorStyle = css`
  font-size: 10px;
  color: #ff7777; /* Red for error */
  padding: 0 10px;
  text-align: left;
  font-weight: 500;
`;

export default CreatorToolContainer;
