import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UserProfile {
  user_id: string;
  email?: string;
  balance: number;
}

interface UserFile {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  size_bytes?: number;
}

interface UserFilesResponse {
  files: UserFile[];
  total: number;
}

// Hook to get API client with authentication
export function useApiClient() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const getHeaders = async (requireAuth: boolean = true): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && isAuthenticated) {
      try {
        const token = await getAccessTokenSilently();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.warn('Failed to get access token:', error);
        // Continue without token for public endpoints
      }
    }

    return headers;
  };

  const request = async <T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getHeaders(requireAuth);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in.');
      }
      if (response.status === 403) {
        throw new Error('Access forbidden. You may not have permission to access this resource.');
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    // Handle different response types
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as T;
  };

  // Audio upload (requires authentication)
  const uploadFile = async (file: File): Promise<{ id: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = await getAccessTokenSilently();
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Sample upload (public endpoint)
  const uploadSample = async (): Promise<{ id: string; message: string }> => {
    return request('/upload/sample', {
      method: 'POST',
    }, false); // No authentication required
  };

  // Audio processing (public endpoints)
  const processPreview = async (
    previewId: string,
    bpm: number,
    volume: number
  ): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE_URL}/process/preview?preview_id=${previewId}&bpm=${bpm}&volume=${volume}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.statusText}`);
    }

    return response.blob();
  };

  const processRaw = async (
    fileId: string,
    bpm: number,
    volume: number
  ): Promise<Blob> => {
    const response = await fetch(
      `${API_BASE_URL}/process/raw?file_id=${fileId}&bpm=${bpm}&volume=${volume}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.statusText}`);
    }

    return response.blob();
  };

  // BPM calculation (public endpoint)
  const getBpmInfo = async (targetBpm: number): Promise<{ base_bpm: number; speed_factor: number }> => {
    return request(`/bpm/${targetBpm}`, {}, false);
  };

  // Health check (public endpoint)
  const healthCheck = async (): Promise<{ status: string; service: string }> => {
    return request('/health', {}, false);
  };

  // User endpoints (require authentication)
  const getUserProfile = async (): Promise<UserProfile> => {
    return request('/user/profile', {}, true);
  };

  const getUserFiles = async (fileType: string = 'raw'): Promise<UserFilesResponse> => {
    return request(`/user/files?file_type=${fileType}`, {}, true);
  };

  const deleteUserFile = async (fileId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/user/files/${fileId}`, {
      method: 'DELETE',
    }, true);
  };

  return {
    request,
    uploadFile,
    uploadSample,
    processPreview,
    processRaw,
    getBpmInfo,
    healthCheck,
    getUserProfile,
    getUserFiles,
    deleteUserFile,
  };
} 