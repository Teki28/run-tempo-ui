const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Hook to get API client
export function useApiClient() {
  const request = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    // Handle different response types
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as T;
  };

  // Audio upload (public endpoint)
  const uploadFile = async (file: File): Promise<{ id: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  };

  // Multiple audio upload (public endpoint)
  const uploadFiles = async (files: File[]): Promise<{ preview_id: string; file_ids: string[] }> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`Upload failed: ${errorData.detail}`);
    }

    return response.json();
  };

  // Sample upload (public endpoint)
  const uploadSample = async (): Promise<{ id: string; message: string }> => {
    return request('/upload/sample', {
      method: 'POST',
    });
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
    volume: number,
    fileCount: number = 1,
    mergeToOneOrNot: boolean = false
  ): Promise<Blob> => {
    const params = new URLSearchParams({
      file_id: fileId,
      total_file_numbers: fileCount.toString(),
      mergeToOneOrNot: mergeToOneOrNot ? 'true' : 'false',
      bpm: bpm.toString(),
      volume: volume.toString()
    });
    const response = await fetch(
      `${API_BASE_URL}/process/raw?${params.toString()}`,
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
    return request(`/bpm/${targetBpm}`);
  };

  // Health check (public endpoint)
  const healthCheck = async (): Promise<{ status: string; service: string }> => {
    return request('/health');
  };

  return {
    request,
    uploadFile,
    uploadFiles,
    uploadSample,
    processPreview,
    processRaw,
    getBpmInfo,
    healthCheck,
  };
} 