'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClient } from '@/lib/api-client';
import { useCreditCheck } from '@/hooks/useCreditCheck';
import { useUserProfile } from '@/contexts/UserProfileContext';
import AudioControls from './AudioControls';
import CreditCheckModal from './CreditCheckModal';

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
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const { isAuthenticated } = useAuth0();
  const { uploadFiles, uploadSample } = useApiClient();
  const { hasSufficientCredits, getCurrentBalance, isProfileLoaded, profileLoading } = useCreditCheck();
  const { refreshProfile } = useUserProfile();

  // Show credit modal if insufficient credits
  const handleInsufficientCredits = () => {
    setShowCreditModal(true);
  };

  const handleNewUpload = useCallback(async (result: UploadResponse) => {
    // Start transition
    setIsTransitioning(true);
    
    // Set a small delay to allow for fade out
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update the result
    setUploadResult(result);
    // Store the number of files uploaded (from selectedFiles)
    onUploadComplete?.(result);
    
    // Refresh user profile to update credit balance (only if authenticated)
    if (isAuthenticated) {
      try {
        await refreshProfile();
      } catch (err) {
        console.error('Failed to refresh user profile after upload:', err);
      }
    }
    
    // End transition after a small delay to allow for fade in
    setTimeout(() => setIsTransitioning(false), 50);
  }, [onUploadComplete, isAuthenticated, refreshProfile, selectedFiles.length]);

  const handleDownloadSuccess = () => {
    // Clear the upload result to force user to re-upload
    setUploadResult(null);
    setError(null);
  };

  const handleSampleMusic = async () => {
    // For non-authenticated users, allow sample music without credit check
    if (isAuthenticated && !hasSufficientCredits(1)) {
      handleInsufficientCredits();
      return;
    }

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
    if (!isAuthenticated) {
      setError('Please log in to upload files');
      return;
    }

    if (acceptedFiles.length === 0) {
      return;
    }
    
    if (acceptedFiles.length > MAX_FILES) {
        setError(`You can upload a maximum of ${MAX_FILES} files at once.`);
        return;
    }

    if (!hasSufficientCredits(acceptedFiles.length)) {
      handleInsufficientCredits();
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
  }, [uploadFiles, handleNewUpload, onUploadError, hasSufficientCredits, isAuthenticated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3']
    },
    disabled: isUploading || (isAuthenticated && profileLoading),
    noClick: !isAuthenticated
  });

  // Show loading state while profile is loading (only for authenticated users)
  if (isAuthenticated && profileLoading) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading user profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Credit Status Display - Only show for authenticated users */}
      {isAuthenticated && isProfileLoaded() && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Available Credits:</span>
            <span className={`font-semibold ${getCurrentBalance() > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {getCurrentBalance()}
            </span>
          </div>
          {getCurrentBalance() === 0 && (
            <p className="text-xs text-red-600 mt-1">
              You need at least 1 credit to upload files.
            </p>
          )}
        </div>
      )}

      {/* Login Required Message for Non-Authenticated Users */}
      {!isAuthenticated && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Please log in to upload your own files</span>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isUploading || (isAuthenticated && profileLoading) ? 'cursor-not-allowed opacity-50' : ''}
          ${!isAuthenticated ? 'cursor-not-allowed opacity-50 bg-gray-50' : 'cursor-pointer hover:border-blue-500'}
          ${isAuthenticated && getCurrentBalance() === 0 ? 'border-red-300 bg-red-50' : ''}
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
          ) : !isAuthenticated ? (
            <div>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Please log in to upload</p>
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
          onClick={!isAuthenticated ? handleSampleMusic : (hasSufficientCredits(1) ? handleSampleMusic : handleInsufficientCredits)}
          disabled={isUploading || (isAuthenticated && profileLoading)}
          className={`px-4 py-2 text-sm font-medium text-white rounded-full transition-colors
            ${isUploading || (isAuthenticated && profileLoading) ? 'bg-gray-400 cursor-not-allowed' : 
              !isAuthenticated ? 'bg-purple-500 hover:bg-purple-600' :
              hasSufficientCredits(1) ? 'bg-purple-500 hover:bg-purple-600' : 'bg-red-500 hover:bg-red-600'}
          `}
        >
          {isUploading ? 'Loading...' : 
           !isAuthenticated ? 'Try Sample Music' :
           !hasSufficientCredits(1) ? 'Get More Credits' : 'Try with Sample Music'}
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

      {/* Credit Check Modal */}
      <CreditCheckModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        currentBalance={getCurrentBalance()}
        requiredCredits={selectedFiles.length > 1 ? selectedFiles.length : 1}
      />
    </div>
  );
}
