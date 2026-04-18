import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Gem, Building2, Mail, Lock, User, Phone, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { TenantService } from '../lib/tenantService';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/ThemeContext';

export function TenantSignup() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const dc = darkMode;

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    agencyName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.agencyName.trim()) e.agencyName = 'Agency name is required';
    if (!form.ownerName.trim()) e.ownerName = 'Your name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) e.ownerEmail = 'Valid email required';
    if (form.ownerPassword.length < 8) e.ownerPassword = 'Password must be at least 8 characters';
    if (!form.ownerPhone.trim()) e.ownerPhone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await TenantService.createTenant(form);
      if (!result.success) {
        toast.error(result.error || 'Signup failed. Please try again.');
      } else {
        setStep('success');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const txt = dc ? 'text-white' : 'text-gray-900';
  const sub = dc ? 'text-gray-400' : 'text-gray-500';
  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    dc
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`;
  const labelCls = `block text-xs font-semibold mb-1.5 ${sub}`;
  const errorCls = 'text-xs text-red-500 mt-1';

  if (step === 'success') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${dc ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-50 to-emerald-50'}`}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`max-w-md w-full text-center p-10 rounded-3xl border ${dc ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} shadow-2xl`}
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${txt}`}>You're all set!</h2>
          <p className={`text-sm mb-2 ${sub}`}>
            Your agency <strong className={txt}>{form.agencyName}</strong> has been created.
          </p>
          <p className={`text-xs mb-8 ${sub}`}>
            Please check your email <strong>{form.ownerEmail}</strong> to verify your account before logging in.
          </p>
          <button
            onClick={() => navigate('/admin/login')}
            className="w-full py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${dc ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-50 to-emerald-50'}`}>
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-10 left-10 w-72 h-72 rounded-full blur-[100px] ${dc ? 'bg-emerald-600/10' : 'bg-emerald-300/30'}`} />
        <div className={`absolute bottom-10 right-10 w-80 h-80 rounded-full blur-[100px] ${dc ? 'bg-teal-600/8' : 'bg-teal-200/40'}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative max-w-lg w-full rounded-3xl border shadow-2xl overflow-hidden ${dc ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}
      >
        {/* Top gradient strip */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        <div className="p-7 sm:p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Gem className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-lg font-extrabold leading-tight ${txt}`}>Emerald CRM</h1>
              <p className={`text-xs ${sub}`}>Start your free trial</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                <Sparkles className="w-3 h-3" /> Free Trial
              </span>
            </div>
          </div>

          <h2 className={`text-xl font-bold mb-1 ${txt}`}>Register your agency</h2>
          <p className={`text-sm mb-6 ${sub}`}>Get your team up and running in under 2 minutes.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Agency Name */}
            <div>
              <label className={labelCls}>Agency / Company Name</label>
              <div className="relative">
                <Building2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                <input
                  id="agencyName"
                  type="text"
                  className={`${inputCls} pl-10`}
                  placeholder="e.g. Emerald Visa Consultancy"
                  value={form.agencyName}
                  onChange={e => setForm(f => ({ ...f, agencyName: e.target.value }))}
                />
              </div>
              {errors.agencyName && <p className={errorCls}>{errors.agencyName}</p>}
            </div>

            {/* Owner Name */}
            <div>
              <label className={labelCls}>Your Full Name</label>
              <div className="relative">
                <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                <input
                  id="ownerName"
                  type="text"
                  className={`${inputCls} pl-10`}
                  placeholder="e.g. Muhammad Atif"
                  value={form.ownerName}
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                />
              </div>
              {errors.ownerName && <p className={errorCls}>{errors.ownerName}</p>}
            </div>

            {/* Email & Phone — 2-col */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email Address</label>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                  <input
                    id="ownerEmail"
                    type="email"
                    className={`${inputCls} pl-10`}
                    placeholder="you@agency.com"
                    value={form.ownerEmail}
                    onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  />
                </div>
                {errors.ownerEmail && <p className={errorCls}>{errors.ownerEmail}</p>}
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <div className="relative">
                  <Phone className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                  <input
                    id="ownerPhone"
                    type="tel"
                    className={`${inputCls} pl-10`}
                    placeholder="+92 300 1234567"
                    value={form.ownerPhone}
                    onChange={e => setForm(f => ({ ...f, ownerPhone: e.target.value }))}
                  />
                </div>
                {errors.ownerPhone && <p className={errorCls}>{errors.ownerPhone}</p>}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
                <input
                  id="ownerPassword"
                  type="password"
                  className={`${inputCls} pl-10`}
                  placeholder="Min. 8 characters"
                  value={form.ownerPassword}
                  onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))}
                />
              </div>
              {errors.ownerPassword && <p className={errorCls}>{errors.ownerPassword}</p>}
            </div>

            {/* Submit */}
            <motion.button
              id="signup-submit"
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full mt-2 py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create My Agency <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className={`text-center text-xs mt-5 ${sub}`}>
            Already have an account?{' '}
            <button onClick={() => navigate('/admin/login')} className="text-emerald-500 hover:underline font-semibold">
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
