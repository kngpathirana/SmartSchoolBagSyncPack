import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { BrandLogo } from './BrandLogo';

// ── Password strength ──────────────────────────────────────────────────────────

interface StrengthRule {
  label: string;
  test: (p: string) => boolean;
}

const RULES: StrengthRule[] = [
  { label: 'At least 8 characters',        test: p => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)',        test: p => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)',        test: p => /[a-z]/.test(p) },
  { label: 'Number (0–9)',                  test: p => /[0-9]/.test(p) },
  { label: 'Special character (!@#$…)',     test: p => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: 'Very Weak', color: 'bg-red-500',    text: 'text-red-600'    },
  { label: 'Weak',      color: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'Fair',      color: 'bg-yellow-500', text: 'text-yellow-600' },
  { label: 'Good',      color: 'bg-blue-500',   text: 'text-blue-600'   },
  { label: 'Strong',    color: 'bg-green-500',  text: 'text-green-600'  },
];

function PasswordStrength({ password }: { password: string }) {
  const passed = useMemo(() => RULES.map(r => r.test(password)), [password]);
  const score  = passed.filter(Boolean).length;
  const level  = LEVELS[Math.max(0, score - 1)];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2 overflow-hidden"
    >
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {LEVELS.map((l, i) => (
            <div
              key={l.label}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < score ? level.color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold ${level.text} min-w-[64px] text-right`}>
          {level.label}
        </span>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {RULES.map((rule, i) => (
          <li key={rule.label} className="flex items-center gap-2 text-xs">
            {passed[i] ? (
              <Check className="size-3 text-green-500 shrink-0" />
            ) : (
              <X className="size-3 text-gray-300 shrink-0" />
            )}
            <span className={passed[i] ? 'text-green-700' : 'text-gray-400'}>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ── Register page ──────────────────────────────────────────────────────────────

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const passed = useMemo(() => RULES.map(r => r.test(password)), [password]);
  const score  = passed.filter(Boolean).length;
  const isStrong = score >= 4;

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');

    if (!isStrong) {
      setError('Please choose a stronger password before continuing.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      console.error('Register error:', code, err);
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your internet connection.');
      } else {
        setError(`Registration failed (${code || 'unknown error'}). Check console for details.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <BrandLogo variant="dark" className="h-32 w-auto max-w-sm bg-black shadow-2xl" />
          <p className="text-blue-100 mt-1">Create a new account</p>
        </div>

        <Card className="p-8 shadow-2xl border-0">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Kasun Perera"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <AnimatePresence>
                <PasswordStrength password={password} />
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className={confirm && confirm !== password ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading || !isStrong || password !== confirm}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-11 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="size-4" />
                  Create Account
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
