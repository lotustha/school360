"use client";

import * as React from "react";
import { Loader2, AlertCircle } from "lucide-react";

// --- PRODUCTION IMPORTS (Uncomment these in your actual app) ---
// import { useSearchParams } from "next/navigation";
// import { signIn } from "next-auth/react"; 

// --- MOCK IMPLEMENTATIONS FOR PREVIEW (Remove these in production) ---
const useSearchParams = () => {
  // Simulates ?msg=onboarded for preview purposes if needed
  // In real app, this hook reads the URL
  return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : "");
};

const signIn = async (provider: string, options: any) => {
  console.log("Mock Login:", provider, options);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
  
  // Simulate success (return undefined/null error) or failure
  if (options.email === "fail@test.com") {
    return { error: "Invalid credentials" };
  }
  return { error: null, ok: true, status: 200, url: null };
};
// ------------------------------------------------------------------

interface LoginFormProps {
  schoolSlug: string;
  callbackUrl?: string;
}

export default function LoginForm({ schoolSlug, callbackUrl }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("msg") === "onboarded") {
      setErrorMessage("Setup complete! Please log in with your new admin credentials.");
    }
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // v4: Client-side signIn
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false, // We handle redirect manually
      });

      if (result?.error) {
        setErrorMessage("Invalid email or password.");
        setIsPending(false);
      } else {
        // Success
        console.log("Login Successful! Redirecting...");
        // In preview we just alert, in prod we redirect
        if (typeof window !== 'undefined' && !document.location.href.includes('googleusercontent')) {
             window.location.href = callbackUrl || `/app/${schoolSlug}`;
        } else {
             setIsPending(false);
             alert(`Redirecting to: /app/${schoolSlug}`);
        }
      }
    } catch (error) {
      setErrorMessage("System error. Please try again later.");
      setIsPending(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {errorMessage && (
        <div className={`p-4 border text-sm rounded-2xl text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2
          ${errorMessage.includes("Setup complete") 
            ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
            : "bg-rose-50 border-rose-100 text-rose-600"
          }
        `}>
          {!errorMessage.includes("Setup complete") && <AlertCircle className="w-4 h-4" />}
          {errorMessage}
        </div>
      )}
      
      <div>
        <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={isPending}
          autoComplete="email"
          className="block w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-50 font-medium text-slate-900"
          placeholder="admin@school.edu.np"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5 ml-1">
          <label htmlFor="password" className="block text-sm font-bold text-slate-700">
            Password
          </label>
          <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          disabled={isPending}
          autoComplete="current-password"
          className="block w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:opacity-50 font-medium text-slate-900"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center ml-1">
        <input
          id="remember-me"
          name="remember-me"
          type="checkbox"
          className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
        />
        <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600 cursor-pointer">
          Keep me signed in
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full h-14 flex justify-center items-center rounded-2xl shadow-lg shadow-emerald-500/20 text-base font-black uppercase tracking-wide text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Authenticating...
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}