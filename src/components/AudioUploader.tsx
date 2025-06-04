'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import AudioControls from './AudioControls';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

interface UploadResponse {
  id: string;
  message: string;
}

interface AudioUploaderProps {
  onUploadComplete?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
}

export default function AudioUploader({ onUploadComplete, onUploadError }: AudioUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleNewUpload = async (result: UploadResponse) => {
    // Start transition
    setIsTransitioning(true);
    
    // Set a small delay to allow for fade out
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update the result
    setUploadResult(result);
    onUploadComplete?.(result);
    
    // End transition after a small delay to allow for fade in
    setTimeout(() => setIsTransitioning(false), 50);
  };

  const handleSampleMusic = async () => {
    // Reset states
    setError(null);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      const response = await axios.post<UploadResponse>(`${API_URL}/upload/sample`);
      await handleNewUpload(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sample music';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Reset states
    setError(null);
    setUploadProgress(0);

    if (!acceptedFiles || acceptedFiles.length === 0) {
      setError('No file selected');
      return;
    }

    const file = acceptedFiles[0];
    
    // Validate file type - check name first as it's always available
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      setError('Please upload an MP3 file only');
      return;
    }

    // Additional MIME type check if available
    if (file.type && !file.type.includes('audio/mpeg')) {
      setError('Please upload a valid MP3 file');
      return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const response = await axios.post<UploadResponse>(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      await handleNewUpload(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3']
    },
    maxFiles: 1,
    disabled: isUploading,
    noClick: false
  });

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isUploading ? 'cursor-not-allowed opacity-50' : 'hover:border-blue-500'}
        `}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {isUploading ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">Uploading...</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600">{uploadProgress}%</div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? 'Drop the MP3 file here...'
                  : 'Drag and drop an MP3 file here, or click to select'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Only MP3 format is supported (max 10MB)
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleSampleMusic}
          disabled={isUploading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-full transition-colors
            ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-500 hover:bg-purple-600'}
          `}
        >
          {isUploading ? 'Loading...' : 'Try with Sample Music'}
        </button>
      </div>
      
      {uploadResult && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
            <div className="text-green-700 font-medium">{uploadResult.message}</div>
            <div className="text-sm space-y-2">
              <div className="p-2 bg-white rounded border border-gray-200">
                <span className="font-medium text-gray-700">File ID: </span>
                <span className="font-mono text-blue-600">{uploadResult.id}</span>
              </div>
            </div>
          </div>
          
          <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <AudioControls key={uploadResult.id} fileId={uploadResult.id} />
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
