'use client';

import { Auth0Provider } from '@auth0/auth0-react';
import { ReactNode } from 'react';
import { auth0Config, validateAuth0Config } from '@/lib/auth0-config';

interface Auth0ProviderWrapperProps {
  children: ReactNode;
}

export function Auth0ProviderWrapper({ children }: Auth0ProviderWrapperProps) {
  // Validate configuration
  if (!validateAuth0Config()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-600">
            Auth0 configuration is missing. Please check your environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={auth0Config.authorizationParams}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
} 