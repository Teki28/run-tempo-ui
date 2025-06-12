'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { Button } from './ui/button';
import { LogIn, LogOut, UserPlus, User } from 'lucide-react';

export function AuthButton() {
  const { 
    isAuthenticated, 
    loginWithRedirect, 
    logout, 
    user, 
    isLoading 
  } = useAuth0();

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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">{user.name || user.email}</span>
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