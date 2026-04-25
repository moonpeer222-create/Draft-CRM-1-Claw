import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Mail, MessageSquare, CreditCard, Bell, Globe, CheckCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  color: string;
  features: string[];
  triggers: string[];
  installed: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send SMS notifications to customers for case updates, reminders, and alerts',
    category: 'Communication',
    icon: MessageSquare,
    color: 'red',
    features: ['Send SMS', 'Two-way messaging', 'Delivery tracking', 'Phone number validation'],
    triggers: ['Case status changed', 'Payment received', 'Document uploaded', 'Deadline reminder'],
    installed: true
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email',
    description: 'Professional email notifications with templates and analytics',
    category: 'Communication',
    icon: Mail,
    color: 'blue',
    features: ['HTML emails', 'Email templates', 'Open/click tracking', 'Bulk sending'],
    triggers: ['Welcome emails', 'Case updates', 'Document requests', 'Invoice delivery'],
    installed: true
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    description: 'Accept payments and create invoices for visa application fees',
    category: 'Payments',
    icon: CreditCard,
    color: 'purple',
    features: ['Payment processing', 'Invoice generation', 'Subscription billing', 'Refunds'],
    triggers: ['Payment received', 'Payment failed', 'Invoice created', 'Refund processed'],
    installed: false
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send WhatsApp messages for instant customer communication',
    category: 'Communication',
    icon: MessageSquare,
    color: 'green',
    features: ['Rich messages', 'Media sharing', 'Template messages', 'Read receipts'],
    triggers: ['Case updates', 'Document requests', 'Appointment reminders', 'Status changes'],
    installed: false
  },
  {
    id: 'slack',
    name: 'Slack Notifications',
    description: 'Team notifications and alerts in Slack channels',
    category: 'Team',
    icon: Bell,
    color: 'purple',
    features: ['Channel posting', 'Direct messages', 'Interactive messages', 'File sharing'],
    triggers: ['New case created', 'High priority alerts', 'Deadline warnings', 'Team mentions'],
    installed: false
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Connect any service via custom HTTP webhooks',
    category: 'Custom',
    icon: Globe,
    color: 'gray',
    features: ['HTTP/HTTPS', 'Custom headers', 'Authentication', 'Retry logic'],
    triggers: ['Any event', 'Custom conditions', 'Scheduled', 'Manual trigger'],
    installed: false
  }
];

export function IntegrationTemplatesTab() {
  const [templates] = useState<Template[]>(TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = filter === 'all'
    ? templates
    : templates.filter(t => t.category === filter);

  const getIconColor = (color: string) => {
    const colors: Record<string, string> = {
      red: 'bg-red-100 text-red-600',
      blue: 'bg-blue-100 text-blue-600',
      purple: 'bg-purple-100 text-purple-600',
      green: 'bg-green-100 text-green-600',
      gray: 'bg-gray-100 text-gray-600'
    };
    return colors[color] || colors.gray;
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowDetailsDialog(true);
  };

  const handleUseTemplate = (template: Template) => {
    console.log('Use template:', template.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Integration Templates</h2>
          <p className="text-sm text-gray-500">Pre-built integrations for popular services</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={filter === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(category)}
            className="capitalize"
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleTemplateClick(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${getIconColor(template.color)}`}>
                  <template.icon className="w-6 h-6" />
                </div>
                {template.installed && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Installed
                  </Badge>
                )}
              </div>
              <div className="pt-4">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="mt-2">{template.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Key Features</p>
                  <div className="flex flex-wrap gap-1">
                    {template.features.slice(0, 3).map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {template.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${getIconColor(selectedTemplate.color)}`}>
                    <selectedTemplate.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedTemplate.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Features</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Common Triggers</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.triggers.map((trigger, i) => (
                      <Badge key={i} variant="outline" className="justify-start">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                    <li>Sign up for {selectedTemplate.name} and get your API credentials</li>
                    <li>Add a new API connection in the Connections tab</li>
                    <li>Create triggers to automate workflows</li>
                    <li>Test your integration with sample data</li>
                  </ol>
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedTemplate.installed ? (
                    <Button variant="outline" className="flex-1">Manage Integration</Button>
                  ) : (
                    <Button className="flex-1" onClick={() => handleUseTemplate(selectedTemplate)}>Use Template</Button>
                  )}
                  <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
