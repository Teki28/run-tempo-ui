import { useUserProfile } from '@/contexts/UserProfileContext';

export const REQUIRED_CREDITS_FOR_UPLOAD = 1;

export function useCreditCheck() {
  const { profile, loading: profileLoading } = useUserProfile();

  const hasSufficientCredits = (requiredCredits: number = REQUIRED_CREDITS_FOR_UPLOAD) => {
    if (profileLoading || !profile) return false;
    return profile.balance >= requiredCredits;
  };

  const getCurrentBalance = () => {
    return profile?.balance || 0;
  };

  const isProfileLoaded = () => {
    return !profileLoading && profile !== null;
  };

  return {
    hasSufficientCredits,
    getCurrentBalance,
    isProfileLoaded,
    profileLoading,
    profile,
  };
} 