import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Palette, Users, Rocket, 
  ChevronRight, ChevronLeft, Check, Sparkles,
  Globe, Clock, DollarSign, ShieldCheck
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '../lib/toast';
import { TenantService } from '../lib/tenantService';

const STEPS = [
  { id: 'agency', title: 'Agency Profile', icon: Building2, desc: 'Setup your base identity' },
  { id: 'brand',  title: 'Branding',       icon: Palette,   desc: 'Make it your own' },
  { id: 'config', title: 'Preferences',    icon: Globe,     desc: 'Regional settings' },
  { id: 'launch', title: 'Launch',         icon: Rocket,    desc: 'Ready to go' },
];

export function OnboardingWizard() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Agency State
  const [agencyData, setAgencyData] = useState({
    name: '',
    logo: '',
    primaryColor: '#10b981', // Emerald default
    timezone: 'UTC+5 (Pakistan)',
    currency: 'PKR',
    language: 'English/Urdu',
  });

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(v => v + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(v => v - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // In a real app, we'd call TenantService.updateTenant(tenantId, agencyData)
      // and set onboarding_completed = true
      await new Promise(r => setTimeout(r, 1500)); // Simulate
      toast.success('Onboarding complete! Welcome to Emerald CRM.');
      navigate('/admin/dashboard');
    } catch (e) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const dc = darkMode;
  const txt = dc ? 'text-white' : 'text-gray-900';
  const sub = dc ? 'text-gray-400' : 'text-gray-500';
  const cardBg = dc ? 'bg-gray-900/50 backdrop-blur-xl border-gray-800' : 'bg-white/80 backdrop-blur-xl border-gray-200';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 ${dc ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-gray-50 to-emerald-50'}`}>
      
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold mb-4"
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Workspace Setup
          </motion.div>
          <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${txt}`}>
            Welcome to the Emerald Family
          </h1>
          <p className={`mt-2 ${sub}`}>Let&apos;s customize your agency workspace in a few seconds.</p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-8 px-4">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex flex-col items-center relative flex-1">
              {/* Connector Line */}
              {i < STEPS.length - 1 && (
                <div className={`absolute top-5 left-1/2 w-full h-[2px] ${i < currentStep ? 'bg-emerald-500' : dc ? 'bg-gray-800' : 'bg-gray-200'}`} />
              )}
              
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center relative z-10 transition-all duration-300 ${
                  i === currentStep ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110' :
                  i < currentStep ? 'bg-emerald-500 text-white' : 
                  dc ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {i < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-bold mt-2 hidden sm:block ${i === currentStep ? 'text-emerald-500' : sub}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <motion.div 
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={`border rounded-3xl p-6 sm:p-10 shadow-2xl ${cardBg}`}
        >
          <div className="min-h-[300px]">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${txt}`}>Agency Identity</h3>
                  <p className={`text-sm ${sub}`}>This is what your clients will see on invoices and portals.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={`text-xs font-bold uppercase ${sub}`}>Agency Name</label>
                    <input 
                      type="text"
                      className={`w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-emerald-500/50 ${dc ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                      placeholder="e.g. Sapphire Travels"
                      value={agencyData.name}
                      onChange={e => setAgencyData({...agencyData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-xs font-bold uppercase ${sub}`}>Contact Email</label>
                    <input 
                      type="email"
                      className={`w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-emerald-500/50 ${dc ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                      placeholder="support@agency.com"
                    />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-500 leading-relaxed">
                    Your data is stored in a private partition. No other agency can access your client records.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${txt}`}>Brand Styling</h3>
                  <p className={`text-sm ${sub}`}>Custom colors make the CRM feel like your propreitary tool.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'].map(color => (
                    <button 
                      key={color}
                      onClick={() => setAgencyData({...agencyData, primaryColor: color})}
                      className={`h-20 rounded-2xl border-4 transition-all ${agencyData.primaryColor === color ? 'border-white scale-105 shadow-xl' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    >
                      {agencyData.primaryColor === color && <Check className="w-6 h-6 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
                <div className="p-10 rounded-3xl border border-dashed border-gray-500/30 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
                    <Building2 className={`w-8 h-8 ${sub}`} />
                  </div>
                  <p className={`text-sm font-medium ${txt}`}>Upload Agency Logo</p>
                  <p className={`text-xs ${sub} mt-1`}>SVG, PNG or JPG (Max 2MB)</p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${txt}`}>Localization</h3>
                  <p className={`text-sm ${sub}`}>Configure how dates and money appear in the system.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className={`text-sm font-bold ${txt}`}>Timezone</p>
                        <p className="text-xs text-emerald-500 font-medium">Applied to activity logs</p>
                      </div>
                    </div>
                    <select className={`w-full px-4 py-2.5 rounded-xl border ${dc ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <option>UTC+5:00 (Pakistan Standard Time)</option>
                      <option>UTC+0:00 (GMT)</option>
                      <option>UTC+4:00 (Dubai)</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className={`text-sm font-bold ${txt}`}>Currency</p>
                        <p className="text-xs text-emerald-500 font-medium">For invoices and payments</p>
                      </div>
                    </div>
                    <select className={`w-full px-4 py-2.5 rounded-xl border ${dc ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <option>PKR - Pakistani Rupee</option>
                      <option>USD - US Dollar</option>
                      <option>AED - UAE Dirham</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="text-center py-10">
                <div className="relative inline-block mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"
                  />
                  <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center relative">
                    <Rocket className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h3 className={`text-2xl font-black ${txt}`}>Houston, we have liftoff!</h3>
                <p className={`mt-2 max-w-sm mx-auto ${sub}`}>
                  Your agency <strong>{agencyData.name || 'Sample Agency'}</strong> is now configured and ready to handle its first clients.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3 max-w-md mx-auto">
                  <div className={`p-4 rounded-2xl border ${dc ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-lg font-bold">100%</p>
                    <p className="text-[10px] uppercase font-bold text-emerald-500">Security Scoped</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${dc ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-lg font-bold">Live</p>
                    <p className="text-[10px] uppercase font-bold text-emerald-500">Realtime Engine</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="mt-10 flex items-center justify-between border-t border-gray-500/10 pt-6">
            <button 
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-0 ${txt} hover:bg-emerald-500/10`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button 
                onClick={nextStep}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={handleFinish}
                disabled={loading}
                className="flex items-center gap-2 px-10 py-2.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30"
              >
                {loading ? 'Finalizing...' : 'Get Started'}
                {!loading && <Rocket className="w-5 h-5" />}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
