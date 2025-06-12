import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Hook to get API client with authentication
export function useApiClient() {
  const { getAccessTokenSilently } = useAuth0();

  const getHeaders = async (): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    try {
      const token = await getAccessTokenSilently();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('Failed to get access token:', error);
      // Continue without token for public endpoints
    }

    return headers;
  };

  const request = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getHeaders();

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

  // Audio upload
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

  // Sample upload
  const uploadSample = async (): Promise<{ id: string; message: string }> => {
    const token = await getAccessTokenSilently();
    
    const response = await fetch(`${API_BASE_URL}/upload/sample`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Sample upload failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Audio processing
  const processPreview = async (
    previewId: string,
    bpm: number,
    volume: number
  ): Promise<Blob> => {
    const token = await getAccessTokenSilently();
    
    const response = await fetch(
      `${API_BASE_URL}/process/preview?preview_id=${previewId}&bpm=${bpm}&volume=${volume}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
    const token = await getAccessTokenSilently();
    
    const response = await fetch(
      `${API_BASE_URL}/process/raw?file_id=${fileId}&bpm=${bpm}&volume=${volume}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Processing failed: ${response.statusText}`);
    }

    return response.blob();
  };

  // BPM calculation (public endpoint)
  const getBpmInfo = async (targetBpm: number): Promise<{ base_bpm: number; speed_factor: number }> => {
    return request(`/bpm/${targetBpm}`);
  };

  // Health check (public endpoint)
  const healthCheck = async (): Promise<{ status: string; service: string }> => {
    return request('/health');
  };

  // User endpoints
  const getUserProfile = async (): Promise<any> => {
    return request('/user/profile');
  };

  const getUserFiles = async (fileType: string = 'raw'): Promise<any> => {
    return request(`/user/files?file_type=${fileType}`);
  };

  const deleteUserFile = async (fileId: string): Promise<any> => {
    return request(`/user/files/${fileId}`, {
      method: 'DELETE',
    });
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