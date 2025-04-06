import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import { atom, useAtom, useSetAtom } from 'jotai';

// Atom to store debug messages
export const debugMessagesAtom = atom<string[]>([]);

// Helper function to add a debug message from anywhere in the app
export const addDebugMessage = (message: string) => {
  const store = window.jotaiStore;
  if (!store) {
    console.error('Jotai store not available');
    return;
  }

  let formattedMessage = message;
  
  // remove individual { } " ' [ ] characters from the message
  formattedMessage = formattedMessage.replace(/[\{\}"'\[\]]/g, '');

  // Add to the store
  const currentMessages = store.get(debugMessagesAtom) || [];
  store.set(debugMessagesAtom, [...currentMessages, formattedMessage]);
  window.dispatchEvent(new CustomEvent('debug-message-added', { detail: formattedMessage }));
};

const InfoPanel: React.FC = () => {
  // Use useState instead of useAtom to ensure component updates
  const [localMessages, setLocalMessages] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Initialize and set up event listener
  useEffect(() => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    addDebugMessage(`[${timestamp}] Application initialized`);
    
    // Get initial messages from the store
    const store = window.jotaiStore;
    if (store) {
      const initialMessages = store.get(debugMessagesAtom) || [];
      setLocalMessages(initialMessages);
    }
    
    // Listen for new debug messages
    const handleNewMessage = () => {
      const store = window.jotaiStore;
      if (store) {
        const currentMessages = store.get(debugMessagesAtom) || [];
        setLocalMessages([...currentMessages]);
      }
    };
    
    // Add event listener
    window.addEventListener('debug-message-added', handleNewMessage);
    
    // Clean up
    return () => {
      window.removeEventListener('debug-message-added', handleNewMessage);
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (contentRef.current && localMessages.length > 0) {
      // Create a more reliable scrolling mechanism
      const scrollToBottom = () => {
        if (contentRef.current) {
          // Force layout recalculation
          const scrollHeight = contentRef.current.scrollHeight;
          contentRef.current.scrollTop = scrollHeight;
        }
      };
      
      // Use MutationObserver to detect when content changes are fully rendered
      const observer = new MutationObserver(() => {
        scrollToBottom();
      });
      
      // Observe changes to the content div
      observer.observe(contentRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Initial scroll attempt
      scrollToBottom();
      
      // Backup scroll attempts with increasing delays
      const scrollAttempts = [10, 50, 100, 300];
      scrollAttempts.forEach(delay => {
        setTimeout(scrollToBottom, delay);
      });
      
      // Cleanup observer on next effect run
      return () => observer.disconnect();
    }
  }, [localMessages]);

  return (
    <div css={debugPanelStyle}>
      <div ref={contentRef} css={debugContentStyle}>
        {localMessages.map((message, index) => (
          <div key={index} css={messageStyle}>
            {message}
          </div>
        ))}
      </div>
    </div>
  );
};


const debugPanelStyle = css`
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 350px;
  height: 75px;

  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  z-index: 1000;
  overflow-y: scroll;
  font-family: monospace;
  font-size: 8px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;

  @media (max-width: 1460px) {
    width: 240px;
  }

  @media (max-width: 1240px) {
    width: 180px;
  }

  @media (max-width: 1120px) {
    display:none;
  }
`;

const debugContentStyle = css`
  padding: 4px;
  max-height: 170px;
  overflow-y: auto;
  color: #00ff00;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
`;

const messageStyle = css`
  margin-bottom: 3px;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.2;
`;

export default InfoPanel;
