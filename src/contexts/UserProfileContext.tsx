'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { userProfileService, UserProfile } from '@/lib/userProfileService';

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
}

export function UserProfileProvider({ children }: UserProfileProviderProps) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await userProfileService.getUserProfile(getAccessTokenSilently);
      setProfile(response);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  // Fetch profile when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isAuthenticated]);

  const value = {
    profile,
    loading,
    error,
    fetchProfile,
    refreshProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
} 