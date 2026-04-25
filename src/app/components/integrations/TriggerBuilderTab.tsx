import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Plus, Pause, Play, Trash2, Edit, Zap, ArrowRight, Filter, Loader2 } from 'lucide-react';
import { integrationsApi } from '../../lib/api';

interface Trigger {
  id: string;
  name: string;
  enabled: boolean;
  event: string;
  condition?: string;
  action: string;
  connection: string;
  lastRun?: string;
  runCount: number;
}

interface ConnectionOption {
  id: string;
  name: string;
  type: string;
}

export function TriggerBuilderTab() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    event: '',
    condition: '',
    action: '',
    connection: ''
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [triggersRes, connectionsRes] = await Promise.all([
          integrationsApi.listTriggers(),
          integrationsApi.listConnections()
        ]);
        if (triggersRes.success && triggersRes.data) {
          setTriggers(triggersRes.data as Trigger[]);
        } else {
          setError(triggersRes.error || 'Failed to load triggers');
        }
        if (connectionsRes.success && connectionsRes.data) {
          setConnections((connectionsRes.data as any[]).map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type
          })));
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAddTrigger = async () => {
    try {
      const payload = {
        name: formData.name,
        event: formData.event,
        condition: formData.condition || undefined,
        action: formData.action,
        connection: formData.connection,
        enabled: true,
        runCount: 0
      };
      const res = await integrationsApi.createTrigger(payload);
      if (res.success && res.data) {
        setTriggers(prev => [...prev, res.data as Trigger]);
        setFormData({ name: '', event: '', condition: '', action: '', connection: '' });
        setShowNewDialog(false);
      } else {
        setError(res.error || 'Failed to create trigger');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create trigger');
    }
  };

  const handleToggle = async (id: string) => {
    const trigger = triggers.find(t => t.id === id);
    if (!trigger) return;
    try {
      const res = await integrationsApi.updateTrigger(id, { enabled: !trigger.enabled });
      if (res.success) {
        setTriggers(prev => prev.map(t =>
          t.id === id ? { ...t, enabled: !t.enabled } : t
        ));
      } else {
        setError(res.error || 'Failed to update trigger');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update trigger');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await integrationsApi.deleteTrigger(id);
      if (res.success) {
        setTriggers(prev => prev.filter(t => t.id !== id));
      } else {
        setError(res.error || 'Failed to delete trigger');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete trigger');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Automation Triggers</h2>
          <p className="text-sm text-gray-500">Create workflows to automate external API calls</p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Trigger
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Automation Trigger</DialogTitle>
              <DialogDescription>
                Define when and how to call external APIs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="trigger-name">Trigger Name</Label>
                <Input
                  id="trigger-name"
                  placeholder="e.g., Send SMS on approval"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event">When this happens...</Label>
                  <Select value={formData.event} onValueChange={(value) => setFormData({ ...formData, event: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="case_created">Case Created</SelectItem>
                      <SelectItem value="case_status_changed">Case Status Changed</SelectItem>
                      <SelectItem value="case_assigned">Case Assigned</SelectItem>
                      <SelectItem value="document_uploaded">Document Uploaded</SelectItem>
                      <SelectItem value="payment_received">Payment Received</SelectItem>
                      <SelectItem value="deadline_approaching">Deadline Approaching</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="condition">Condition (Optional)</Label>
                  <Input
                    id="condition"
                    placeholder='e.g., status = "Approved"'
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="action">Do this...</Label>
                  <Select value={formData.action} onValueChange={(value) => setFormData({ ...formData, action: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_sms">Send SMS</SelectItem>
                      <SelectItem value="send_email">Send Email</SelectItem>
                      <SelectItem value="send_whatsapp">Send WhatsApp Message</SelectItem>
                      <SelectItem value="create_payment">Create Payment Link</SelectItem>
                      <SelectItem value="post_slack">Post to Slack</SelectItem>
                      <SelectItem value="webhook">Call Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="connection">Using connection...</Label>
                  <Select value={formData.connection} onValueChange={(value) => setFormData({ ...formData, connection: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                      ))}
                      {connections.length === 0 && (
                        <SelectItem value="__none__" disabled>No connections available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Workflow Preview</h4>
                <div className="flex items-center gap-3 text-sm">
                  <div className="bg-white px-3 py-2 rounded border border-blue-200">
                    {formData.event || 'Event'}
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                  {formData.condition && (
                    <>
                      <div className="bg-white px-3 py-2 rounded border border-blue-200 flex items-center gap-2">
                        <Filter className="w-3 h-3" />
                        {formData.condition}
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                    </>
                  )}
                  <div className="bg-white px-3 py-2 rounded border border-blue-200">
                    {formData.action || 'Action'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddTrigger} className="flex-1">Create Trigger</Button>
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
          {triggers.map((trigger) => (
            <Card key={trigger.id} className={!trigger.enabled ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg mt-1 ${trigger.enabled ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      <Zap className={`w-5 h-5 ${trigger.enabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{trigger.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <Badge variant="outline">{trigger.event}</Badge>
                        {trigger.condition && (
                          <>
                            <span className="text-gray-400">→</span>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Filter className="w-3 h-3" />
                              {trigger.condition}
                            </Badge>
                          </>
                        )}
                        <span className="text-gray-400">→</span>
                        <Badge variant="outline">{trigger.action}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Switch
                      checked={trigger.enabled}
                      onCheckedChange={() => handleToggle(trigger.id)}
                    />
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(trigger.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span>Connection: <span className="font-medium text-gray-700">{trigger.connection}</span></span>
                    <span>Runs: <span className="font-medium text-gray-700">{trigger.runCount}</span></span>
                    {trigger.lastRun && <span>Last run: {trigger.lastRun}</span>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleToggle(trigger.id)}>
                    {trigger.enabled ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {trigger.enabled ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && triggers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No triggers configured</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first automation trigger</p>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Trigger
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
