import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import FileUpload from '../components/FileUpload';
import { FileText, Download, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentItem {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  is_verified: boolean;
  created_at: string;
  case_id: string | null;
}

export default function Documents() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setDocs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && profile) {
      fetchDocs();
    }
  }, [profile, authLoading]);

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link');
      return;
    }

    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = fileName;
    a.click();
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;

    // Delete from storage first
    const { error: storageErr } = await supabase.storage
      .from('documents')
      .remove([doc.file_path]);

    if (storageErr) {
      toast.error(storageErr.message);
      return;
    }

    // Delete from database
    const { error: dbErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id);

    if (dbErr) {
      toast.error(dbErr.message);
    } else {
      toast.success('Document deleted');
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Documents
            </h1>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Document
          </h2>
          <FileUpload onUploadComplete={fetchDocs} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Documents
            </h2>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No documents yet. Upload your first file above.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatSize(doc.file_size)} •{' '}
                        {new Date(doc.created_at).toLocaleDateString()}
                        {doc.is_verified && (
                          <span className="ml-2 text-emerald-600 font-medium">
                            Verified
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(doc.file_path, doc.file_name)}
                      className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
