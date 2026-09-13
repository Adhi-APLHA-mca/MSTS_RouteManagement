import { useState, type FormEvent } from 'react';
import { LockKeyhole, TrainFront } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiManagerAuth } from '@/lib/api';

export function ManagerLogin() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiManagerAuth.login(username, password);
      window.localStorage.setItem('msts-manager-token', result.token);
      window.localStorage.setItem('msts-manager-username', result.username);
      navigate('/routes');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f0] px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#d6e3dd] bg-[#fffdf9] p-7 shadow-[0_18px_50px_rgba(33,67,63,0.10)] sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#286c5b] text-[#f8fffb]"><TrainFront size={21} /></div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.04em] text-[#183a3a]">Route manager access</h1>
        <p className="mt-2 text-sm leading-6 text-[#607875]">Sign in to manage routes, client details, models, and scheduled runs.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="space-y-2"><Label htmlFor="manager-username">Manager username</Label><Input id="manager-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></div>
          <div className="space-y-2"><Label htmlFor="manager-password">Password</Label><Input id="manager-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          {error && <p className="rounded-lg border border-[#e7c6ae] bg-[#fff5ed] px-3 py-2.5 text-xs leading-5 text-[#955832]">{error}</p>}
          <Button type="submit" disabled={loading} className="h-11 w-full gap-2 rounded-lg bg-[#286c5b] font-semibold text-[#f8fffb] shadow-none hover:bg-[#1f5b4c]"><LockKeyhole size={15} />{loading ? 'Checking access…' : 'Sign in'}</Button>
        </form>
      </div>
    </main>
  );
}