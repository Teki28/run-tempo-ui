interface UserCreditResponse {
  user_id: string;
  credit: number;
  success: boolean;
  message: string;
}

class UserCreditService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async getUserCredit(getToken: () => Promise<string>): Promise<UserCreditResponse> {
    try {
      const token = await getToken();

      const response = await fetch(`${this.baseUrl}/user-credit/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserCreditResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user credit:', error);
      throw error;
    }
  }

  async setUserCredit(credit: number, getToken: () => Promise<string>): Promise<UserCreditResponse> {
    try {
      const token = await getToken();

      const response = await fetch(`${this.baseUrl}/user-credit/balance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credit),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserCreditResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error setting user credit:', error);
      throw error;
    }
  }

  async addUserCredit(amount: number, getToken: () => Promise<string>): Promise<UserCreditResponse> {
    try {
      const token = await getToken();

      const response = await fetch(`${this.baseUrl}/user-credit/balance/add`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(amount),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserCreditResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error adding user credit:', error);
      throw error;
    }
  }

  async deductUserCredit(amount: number, getToken: () => Promise<string>): Promise<UserCreditResponse> {
    try {
      const token = await getToken();

      const response = await fetch(`${this.baseUrl}/user-credit/balance/deduct`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(amount),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserCreditResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error deducting user credit:', error);
      throw error;
    }
  }
}

export const userCreditService = new UserCreditService();
export type { UserCreditResponse }; 