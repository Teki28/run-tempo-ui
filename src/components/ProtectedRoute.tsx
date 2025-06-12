'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { ReactNode } from 'react';
import { AuthButton } from './AuthButton';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Run Tempo
            </h1>
            <p className="text-gray-600">
              Please sign in to access the audio processing features.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            <AuthButton />
          </div>
          
          {fallback && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              {fallback}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 