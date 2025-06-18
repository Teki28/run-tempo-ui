'use client';

import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from './ui/button';
import { LogIn, LogOut, UserPlus, User, Coins } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { UserProfileModal } from './UserProfileModal';

export function AuthButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { 
    isAuthenticated, 
    loginWithRedirect, 
    logout, 
    user, 
    isLoading 
  } = useAuth0();

  const { profile, loading: profileLoading } = useUserProfile();

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const handleSignup = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  };

  const handleUserClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <Button disabled className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        Loading...
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4" />
            <button
              onClick={handleUserClick}
              className="hidden sm:inline hover:text-blue-600 transition-colors cursor-pointer"
            >
              {user.name || user.email}
            </button>
            {profile && (
              <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                <Coins className="w-3 h-3" />
                <span>{profile.balance}</span>
                {profileLoading && (
                  <div className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            )}
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
        
        <UserProfileModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button 
        onClick={handleLogin}
        className="flex items-center gap-2"
      >
        <LogIn className="w-4 h-4" />
        Login
      </Button>
      <Button 
        onClick={handleSignup}
        variant="outline"
        className="flex items-center gap-2"
      >
        <UserPlus className="w-4 h-4" />
        Sign Up
      </Button>
    </div>
  );
} 