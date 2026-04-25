import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Trash2, Edit, CheckCircle, XCircle, Key, Loader2 } from 'lucide-react';
import { integrationsApi } from '../../lib/api';

interface APIConnection {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
  baseUrl?: string;
  createdAt: string;
  lastUsed?: string;
}

export function APIConnectionsTab() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    apiKey: '',
    baseUrl: ''
  });

  useEffect(() => {
    async function fetchConnections() {
      try {
        setLoading(true);
        const res = await integrationsApi.listConnections();
        if (res.success && res.data) {
          setConnections(res.data as APIConnection[]);
        } else {
          setError(res.error || 'Failed to load connections');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  const handleAddConnection = async () => {
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        apiKey: formData.apiKey,
        baseUrl: formData.baseUrl || undefined,
        status: 'active' as const,
      };
      const res = await integrationsApi.createConnection(payload);
      if (res.success && res.data) {
        setConnections(prev => [...prev, res.data as APIConnection]);
        setFormData({ name: '', type: '', apiKey: '', baseUrl: '' });
        setShowNewDialog(false);
      } else {
        setError(res.error || 'Failed to create connection');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create connection');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await integrationsApi.deleteConnection(id);
      if (res.success) {
        setConnections(prev => prev.filter(c => c.id !== id));
      } else {
        setError(res.error || 'Failed to delete connection');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete connection');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">API Connections</h2>
          <p className="text-sm text-gray-500">Manage external API credentials and connections</p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add API Connection</DialogTitle>
              <DialogDescription>
                Configure a new external API connection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Twilio"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="type">Service Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio (SMS)</SelectItem>
                    <SelectItem value="sendgrid">SendGrid (Email)</SelectItem>
                    <SelectItem value="stripe">Stripe (Payments)</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="custom">Custom REST API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.example.com"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddConnection} className="flex-1">Add Connection</Button>
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg mt-1">
                      <Key className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{connection.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span className="capitalize">{connection.type}</span>
                        {connection.status === 'active' ? (
                          <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(connection.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {connection.baseUrl && (
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Base URL</p>
                        <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1 truncate">
                          {connection.baseUrl}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t">
                    <span>Created: {connection.createdAt}</span>
                    {connection.lastUsed && <span>Last used: {connection.lastUsed}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && connections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No API connections yet</h3>
            <p className="text-sm text-gray-500 mb-4">Add your first API connection to get started</p>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
