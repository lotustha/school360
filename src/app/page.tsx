import { 
  CheckCircle2, 
  School, 
  ShieldCheck, 
  Zap, 
  WifiOff, 
  ArrowRight,
  Globe,
  Calculator
} from "lucide-react";

// Using a relative path to ensure the bundler can locate the component
import { PricingCalculator } from "../components/marketing/pricing-calculator";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-2xl text-primary tracking-tight">
          <div className="bg-primary text-white p-1.5 rounded-lg">
            <School className="w-6 h-6" />
          </div>
          <span>School360</span>
        </div>
        
        <nav className="hidden md:flex gap-8">
          <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
          <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</a>
          <a href="#compliance" className="text-sm font-medium hover:text-primary transition-colors">Compliance</a>
        </nav>

        <div className="flex items-center gap-4">
          {/* Replaced next/link with <a> for preview compatibility */}
          <a href="/login" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 hidden sm:inline-flex">
            Login
          </a>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
            Get Started
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white pt-16 pb-24 lg:pt-32 lg:pb-40">
          <div className="container px-4 mx-auto relative z-10 text-center max-w-5xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-xs font-bold mb-6 border border-primary/10">
              <Globe className="w-3 h-3" />
              NEPAL ENTERPRISE EDITION 4.0
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
              The Operating System for <br />
              <span className="text-primary italic">Nepal's Modern Schools.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Manage Fees, Exams, Transport, and IRD-Taxation in one app. Fully compliant with SSF, CDC, and MoE regulations for 2081/82.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-lg font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-14 px-8 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-lg font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-primary/20 bg-background hover:bg-secondary h-14 px-8 w-full sm:w-auto">
                Request a Demo
              </button>
            </div>
          </div>
          
          {/* Background Decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-5 pointer-events-none">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:40px_40px]"></div>
          </div>
        </section>

        {/* Features Showcase */}
        <section id="features" className="py-24 bg-secondary/30">
          <div className="container px-4 mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 tracking-tight">Built for local challenges</h2>
              <p className="text-lg text-muted-foreground">Specifically engineered for the Nepal Government curriculum and tax laws.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="bg-white p-8 rounded-2xl border border-primary/5 shadow-sm group hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Nepal Govt Compliant</h3>
                <p className="text-muted-foreground">
                  Auto-generate Talabi Bharpai, SSF, and TDS Reports. Stay 100% compliant with IRD taxation rules for Chain Schools.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-primary/5 shadow-sm group hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <Calculator className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Exam & CAS Engine</h3>
                <p className="text-muted-foreground">
                  Continuous Assessment System (CAS) for Grades 1-8. Grade merging and auto-GPA calculation as per NEB standards.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-primary/5 shadow-sm group hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <WifiOff className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Offline Capable</h3>
                <p className="text-muted-foreground">
                  Internet down? No problem. Record attendance and marks offline; our system syncs automatically when back online.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Calculator Section */}
        <section id="pricing" className="py-24 bg-white">
          <div className="container px-4 mx-auto">
            <PricingCalculator />
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-16 px-6 mt-auto">
        <div className="container mx-auto grid md:grid-cols-4 gap-12 max-w-6xl">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-bold text-2xl text-white mb-6">
              <School className="w-6 h-6 text-primary" />
              <span>School360</span>
            </div>
            <p className="max-w-xs mb-6 text-sm">
              The #1 Choice for modern education in Nepal. From small montessori to university campuses.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6">Modules</h4>
            <ul className="space-y-3 text-sm">
              <li>Finance & IRD</li>
              <li>Exam & CAS</li>
              <li>Transport GPS</li>
              <li>Mobile App</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6">Compliance</h4>
            <ul className="space-y-3 text-sm">
              <li>Talabi Bharpai</li>
              <li>SSF Integration</li>
              <li>TDS Calculations</li>
              <li>MoE Reporting</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-16 pt-8 border-t border-slate-800 text-xs text-center">
          © {new Date().getFullYear()} School360 Ecosystem (Nepal). Built with precision for your institution.
        </div>
      </footer>
    </div>
  );
}