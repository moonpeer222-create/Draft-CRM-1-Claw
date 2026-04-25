import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Webhook, CheckCircle, XCircle, Clock, Copy, RefreshCw, ChevronDown, ChevronRight, Plus, Loader2, Trash2 } from 'lucide-react';
import { integrationsApi } from '../../lib/api';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  active: boolean;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  endpoint: string;
  method: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  timestamp: string;
  payload: any;
  response?: any;
  duration?: number;
}

export function WebhookMonitorTab() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [newWebhookForm, setNewWebhookForm] = useState({ name: '', url: '' });

  async function fetchData() {
    try {
      setLoading(true);
      const [webhooksRes, logsRes] = await Promise.all([
        integrationsApi.listWebhooks(),
        integrationsApi.listWebhookLogs()
      ]);
      if (webhooksRes.success && webhooksRes.data) {
        setEndpoints(webhooksRes.data as WebhookEndpoint[]);
      } else {
        setError(webhooksRes.error || 'Failed to load webhooks');
      }
      if (logsRes.success && logsRes.data) {
        setLogs(logsRes.data as WebhookLog[]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Success
        </Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>;
      default:
        return null;
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const res = await integrationsApi.createWebhook({
        name: newWebhookForm.name,
        url: newWebhookForm.url,
        active: true
      });
      if (res.success && res.data) {
        setEndpoints(prev => [...prev, res.data as WebhookEndpoint]);
        setNewWebhookForm({ name: '', url: '' });
        setShowNewDialog(false);
      } else {
        setError(res.error || 'Failed to create webhook');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create webhook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await integrationsApi.deleteWebhook(id);
      if (res.success) {
        setEndpoints(prev => prev.filter(e => e.id !== id));
      } else {
        setError(res.error || 'Failed to delete webhook');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete webhook');
    }
  };

  return (
    <div className="space-y-6">
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
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-500">Total Webhooks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold">{logs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-500">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold">
                  {logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-500">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold">
                  {logs.filter(l => l.duration).length > 0
                    ? Math.round(logs.filter(l => l.duration).reduce((acc, l) => acc + (l.duration || 0), 0) / logs.filter(l => l.duration).length)
                    : 0}ms
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhook Endpoints</CardTitle>
                  <CardDescription>Incoming webhook URLs for external services</CardDescription>
                </div>
                <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Endpoint
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Webhook Endpoint</DialogTitle>
                      <DialogDescription>Generate a new webhook URL to receive events</DialogDescription>
                    </DialogHeader>
                    <Alert>
                      <AlertDescription>
                        When connected to Supabase, this will generate a real edge function endpoint with signature verification.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label htmlFor="wh-name">Name</Label>
                        <Input
                          id="wh-name"
                          placeholder="e.g., Payment Notifications"
                          value={newWebhookForm.name}
                          onChange={(e) => setNewWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="wh-url">URL</Label>
                        <Input
                          id="wh-url"
                          placeholder="https://your-app.com/webhooks/events"
                          value={newWebhookForm.url}
                          onChange={(e) => setNewWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleCreateWebhook} className="flex-1">Create</Button>
                        <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {endpoints.map((endpoint) => (
                  <div key={endpoint.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{endpoint.name}</h4>
                        {endpoint.active && (
                          <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                        )}
                      </div>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{endpoint.url}</code>
                      {endpoint.secret && (
                        <p className="text-xs text-gray-500 mt-2">Secret: {endpoint.secret}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(endpoint.url, endpoint.id)}
                      >
                        {copiedUrl === endpoint.id ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(endpoint.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
                {endpoints.length === 0 && (
                  <div className="text-sm text-gray-500 py-4 text-center">No webhook endpoints configured</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Webhook request logs and responses</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <TableCell>
                          {expandedLog === log.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{log.endpoint}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.method}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{log.timestamp}</TableCell>
                        <TableCell className="text-sm">
                          {log.duration ? `${log.duration}ms` : '-'}
                        </TableCell>
                      </TableRow>
                      {expandedLog === log.id && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">Request Payload</h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                              {log.response && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Response</h4>
                                  <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                                    {JSON.stringify(log.response, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.statusCode && (
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span>Status Code: <span className="font-medium">{log.statusCode}</span></span>
                                  {log.duration && <span>Duration: <span className="font-medium">{log.duration}ms</span></span>}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-8">
                        No webhook logs available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
