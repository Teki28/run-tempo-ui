export const auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '',
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '',
  authorizationParams: {
    redirect_uri: typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_AUTH0_REDIRECT_URI || 'http://localhost:3000',
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || '',
    scope: 'openid profile email'
  }
};

// Validate configuration
export const validateAuth0Config = () => {
  const missing = [];
  
  if (!auth0Config.domain) {
    missing.push('NEXT_PUBLIC_AUTH0_DOMAIN');
  }
  
  if (!auth0Config.clientId) {
    missing.push('NEXT_PUBLIC_AUTH0_CLIENT_ID');
  }
  
  if (!auth0Config.authorizationParams.audience) {
    missing.push('NEXT_PUBLIC_AUTH0_AUDIENCE');
  }
  
  if (missing.length > 0) {
    console.error('Missing Auth0 environment variables:', missing);
    console.error('Current config:', {
      domain: auth0Config.domain ? '✓ Set' : '✗ Missing',
      clientId: auth0Config.clientId ? '✓ Set' : '✗ Missing',
      audience: auth0Config.authorizationParams.audience ? '✓ Set' : '✗ Missing'
    });
    return false;
  }
  
  return true;
}; 