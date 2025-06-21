import { useUserProfile } from '@/contexts/UserProfileContext';

export function useCreditCheck() {
  const { profile, loading: profileLoading } = useUserProfile();

  const hasSufficientCredits = (requiredCredits: number) => {
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