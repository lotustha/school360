import { notFound } from "next/navigation";
import { Metadata } from "next";
import { ShieldCheck, Globe } from "lucide-react";
import LoginForm from "./login-form";
import { getSchoolFromSubdomain } from "./actions";

// --- Metadata ---

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const school = await getSchoolFromSubdomain(resolvedParams.domain);
  
  if (!school) return { title: "School Not Found" };
  
  return { 
    title: `Login Portal - ${school.name}`,
    description: `Secure access for staff and students of ${school.name}`
  };
}

// --- Main Page Component ---

export default async function LoginPage({ params }: { params: Promise<{ domain: string }> }) {
  const resolvedParams = await params;
  
  // 1. Fetch School Data from Database
  const school = await getSchoolFromSubdomain(resolvedParams.domain);

  // 2. Handle Invalid Subdomains
  if (!school) {
    notFound(); 
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-emerald-100/50 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-sky-100/50 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Branding Header - Populated from Database */}
        <div className="text-center mb-8 animate-in slide-in-from-top-4 duration-700">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-500 rounded-[24px] flex items-center justify-center shadow-2xl shadow-emerald-500/30 ring-8 ring-white rotate-3 hover:rotate-6 transition-transform duration-300 overflow-hidden bg-white">
              {/* Logic: If logo exists and isn't the placeholder, show Image. Else show Shield. */}
              {school.logoUrl && school.logoUrl !== "INSTITUTION_SEAL_V1" ? (
                <img 
                  src={school.logoUrl} 
                  alt={`${school.name} Logo`} 
                  className="w-full h-full object-cover p-2" 
                />
              ) : (
                <ShieldCheck className="text-white w-10 h-10" />
              )}
            </div>
          </div>

          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            Welcome back to <br/>
            {/* Dynamic Institute Name */}
            <span className="text-emerald-600">{school.name}</span>
          </h2>

          <p className="text-sm font-medium text-slate-500">
            Secure Institutional Access Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] rounded-[32px] border border-slate-100 animate-in slide-in-from-bottom-4 duration-700 delay-150">
          
          <LoginForm schoolSlug={school.slug} />

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-widest font-black">
              <Globe size={12} className="text-emerald-500" />
              End-to-End Encrypted
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-300">
          <p className="text-[10px] font-bold text-slate-300 hover:text-emerald-500 transition-colors cursor-default">
            Powered by {process.env.NEXT_PUBLIC_APP_NAME || "School360"} Technology
          </p>
        </div>
      </div>
    </div>
  );
}