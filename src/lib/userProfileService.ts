interface UserProfile {
  user_id: string;
  email?: string;
  balance: number;
}

class UserProfileService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async getUserProfile(getToken: () => Promise<string>): Promise<UserProfile> {
    try {
      const token = await getToken();

      const response = await fetch(`${this.baseUrl}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserProfile = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
}

export const userProfileService = new UserProfileService();
export type { UserProfile }; 