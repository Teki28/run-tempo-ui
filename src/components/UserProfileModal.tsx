'use client';

import { useState } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { User, Coins, X } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { profile, loading, error } = useUserProfile();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5" />
            User Profile
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-gray-600">Loading profile...</span>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-center py-4">
              Error loading profile: {error}
            </div>
          )}

          {!loading && !error && profile && (
            <div className="space-y-4">
              {/* Balance Section */}
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-gray-900">Balance</span>
                </div>
                <span className="text-2xl font-bold text-yellow-700">{profile.balance}</span>
              </div>

              {/* User Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">User ID</span>
                  <span className="text-sm font-mono text-gray-900">{profile.user_id}</span>
                </div>
                
                {profile.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Email</span>
                    <span className="text-sm text-gray-900">{profile.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
} 