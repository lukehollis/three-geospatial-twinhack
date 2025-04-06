import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Button, Spinner, Popover, Menu, MenuItem } from '@blueprintjs/core';
import { css } from '@emotion/react';

// Import environment variables at the top level
const API_URL = import.meta.env['VITE_API_URL'] as string;

const AuthButton: React.FC = () => {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user, getAccessTokenSilently, error } = useAuth0();
  
  // Debug logging
  React.useEffect(() => {
    // Check if we're in the callback state (URL contains code parameter)
    const hasAuthCode = window.location.search.includes('code=');
    if (hasAuthCode && !isAuthenticated && !isLoading) {
      // Remove the code from URL and refresh the page
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
    }
  }, [isAuthenticated, isLoading, user, error]);

  // Function to get token and register user with the backend
  const getToken = async () => {
    try {
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string;
      
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: audience,
          scope: 'openid profile email'
        },
      });
      
      // Store token in localStorage for API calls
      localStorage.setItem('auth_token', token);
      
      // Register the user with our backend API
      await registerUserWithBackend(token);
      
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return null;
    }
  };
  
  // Register user with our backend API
  const registerUserWithBackend = async (token: string) => {
    try {
      
      const url = `${API_URL}/auth/register`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      
      if (response.ok) {
        const userData = await response.json();
      } else {
        const errorText = await response.text();
      }
    } catch (error) {
      console.error('Error registering user with backend:', error);
    }
  };

  // Get token when user is authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      getToken();
    }
  }, [isAuthenticated, user]);
  
  // Handle auth errors
  React.useEffect(() => {
    if (error) {
      console.error('Auth0 error:', error);
    }
  }, [error]);
  

  if (isLoading) {
    return (
      <div css={authButtonStyle}>
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div css={authButtonStyle}>
      {isAuthenticated ? (
        <Popover
          content={
            <Menu>
              <MenuItem text={`Signed in as ${user?.name || user?.email}`} disabled />
              <MenuItem
                icon="log-out"
                text="Log Out"
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              />
            </Menu>
          }
          placement="bottom-end"
        >
          <Button
            icon="user"
            small
            minimal
            fill
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
              border: '1px solid #444',
              color: 'white',
              padding: '8px 12px',
              backgroundImage: 'none',
              backdropFilter: 'blur(5px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}
          >
            {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
          </Button>
        </Popover>
      ) : (
        <Button
          icon="log-in"
          onClick={() => loginWithRedirect()}
          small
          minimal
          fill
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            border: '1px solid #444',
            color: 'white',
            padding: '8px 12px',
            backgroundImage: 'none',    
            backdropFilter: 'blur(5px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            textTransform: 'uppercase',
            fontSize: '10px',
            fontWeight: 'bold'
          }}
        >
          Login / Sign Up
        </Button>
      )}
    </div>
  );
};

const authButtonStyle = css`
`;


export default AuthButton;