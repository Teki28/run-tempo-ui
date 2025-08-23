'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useApiClient } from '@/lib/api-client';
import AudioControls from './AudioControls';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_FILES = parseInt(process.env.NEXT_PUBLIC_MAX_UPLOAD_FILES || '5');

interface UploadResponse {
  preview_id: string; // This will be the preview_id
  message?: string;
  file_ids?: string[];
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const { uploadFiles, uploadSample } = useApiClient();

  const handleNewUpload = useCallback(async (result: UploadResponse) => {
    setIsTransitioning(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setUploadResult(result);
    onUploadComplete?.(result);
    setTimeout(() => setIsTransitioning(false), 50);
  }, [onUploadComplete]);

  const handleDownloadSuccess = () => {
    // Clear the upload result to force user to re-upload
    setUploadResult(null);
    setError(null);
  };

  const handleSampleMusic = async () => {
    // Reset states
    setError(null);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      setUploadProgress(50); // Simulate progress
      
      const response = await uploadSample();
      setUploadProgress(100);
      
      await handleNewUpload(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sample music';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return;
    }
    
    if (acceptedFiles.length > MAX_FILES) {
        setError(`You can upload a maximum of ${MAX_FILES} files at once.`);
        return;
    }

    // Reset states
    setError(null);
    setUploadProgress(0);
    setSelectedFiles(acceptedFiles);
    
    for (const file of acceptedFiles) {
        if (!file.name.toLowerCase().endsWith('.mp3')) {
            setError('Please upload MP3 files only.');
            setSelectedFiles([]);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setError(`File ${file.name} exceeds the 10MB size limit.`);
            setSelectedFiles([]);
            return;
        }
    }

    try {
      setIsUploading(true);
      setUploadProgress(50);
      
      const response = await uploadFiles(acceptedFiles);
      setUploadProgress(100);
      
      await handleNewUpload(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setSelectedFiles([]);
    }
  }, [uploadFiles, handleNewUpload, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3']
    },
    disabled: isUploading,
    noClick: false
  });

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue-500'}
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
          ) : selectedFiles.length > 0 ? (
            <div>
                <p className="text-sm text-gray-600">{selectedFiles.length} file(s) selected.</p>
                <ul className="text-xs text-left text-gray-500 mt-2 list-disc list-inside">
                    {selectedFiles.map(f => <li key={f.name}>{f.name}</li>)}
                </ul>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // This button is not really needed if drop triggers upload automatically
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
                >
                    Upload
                </button>
            </div>
          ) : (
            <div>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">
                {isDragActive ? 'Drop the files here...' : `Drag & drop up to ${MAX_FILES} MP3 files here, or click to select`}
              </p>
              <p className="text-xs text-gray-500 mt-2">Max 10MB each</p>
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
          {isUploading ? 'Loading...' : 'Try Sample Music'}
        </button>
      </div>
      
      {uploadResult && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
            <div className="text-green-700 font-medium">
              {uploadResult.message || 'Upload successful!'}
            </div>
            <div className="text-sm space-y-2">
              <div className="p-2 bg-white rounded border border-gray-200">
                <span className="font-medium text-gray-700">File ID: </span>
                <span className="font-mono text-blue-600">{uploadResult.preview_id}</span>
              </div>
            </div>
          </div>
          <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <AudioControls key={uploadResult.preview_id} fileId={uploadResult.preview_id} fileCount={uploadResult.file_ids ? uploadResult.file_ids.length : 1} onDownloadSuccess={handleDownloadSuccess} />
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
