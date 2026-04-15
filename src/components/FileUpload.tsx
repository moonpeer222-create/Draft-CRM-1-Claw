import { useState, useCallback } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface FileUploadProps {
  caseId?: string | null;
  onUploadComplete?: () => void;
}

export default function FileUpload({ caseId, onUploadComplete }: FileUploadProps) {
  const { profile } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const orgId = profile?.organization_id;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => setSelectedFile(null);

  const uploadFile = async () => {
    if (!selectedFile || !orgId) {
      toast.error('No file selected or missing organization');
      return;
    }

    setIsUploading(true);

    try {
      // Build storage path: org_id/filename
      const timestamp = Date.now();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${orgId}/${timestamp}_${safeName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert record into documents table
      const { error: dbError } = await supabase.from('documents').insert({
        organization_id: orgId,
        case_id: caseId || null,
        uploaded_by: profile?.id || null,
        file_name: selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type || null,
        file_size: selectedFile.size,
        is_verified: false,
      });

      if (dbError) throw dbError;

      toast.success('File uploaded successfully');
      setSelectedFile(null);
      onUploadComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          You must be part of an organization to upload documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
          }
        `}
      >
        <Upload className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Drag and drop a file here, or{' '}
          <label className="text-emerald-600 hover:text-emerald-500 cursor-pointer">
            browse
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Max file size: 50MB
        </p>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            <File className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={uploadFile}
              disabled={isUploading}
              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Upload'
              )}
            </button>
            <button
              onClick={clearFile}
              disabled={isUploading}
              className="p-1.5 text-gray-500 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
