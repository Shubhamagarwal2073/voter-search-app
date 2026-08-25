"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Menu, X, ArrowLeft, LogIn } from 'lucide-react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scaleY, setScaleY] = useState(1);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (textRef.current) {
        const h = textRef.current.offsetHeight;
        if (h > 0) {
          setScaleY((window.innerHeight / h));
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-slate-50 relative">
      
      {/* BACKGROUND "LOGIN" TEXT EFFECT */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] z-0"
      >
        <div className="relative flex items-center justify-center">
          <div 
            className="text-slate-900 font-black leading-none tracking-tighter whitespace-nowrap"
            style={{
              fontSize: 'clamp(80px, 25vw, 400px)',
              transformOrigin: 'center'
            }}
          >
            LOGIN
          </div>
        </div>
      </div>

      {/* NAVIGATION BAR */}
      <nav className="relative z-20 flex flex-row items-center justify-between px-4 sm:px-6 md:px-12 py-4 sm:py-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-slate-800 rounded-full"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-slate-800 rounded-full"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-slate-800 rounded-full"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-slate-800 rounded-full"></div>
            </div>
            <span className="text-slate-900 font-black text-xl sm:text-2xl tracking-tight leading-none drop-shadow-sm">Electoral Explorer</span>
          </div>
          
          <div className="ml-8 flex flex-col items-start gap-2.5">
            <h2 className="text-slate-600 font-bold tracking-widest text-[10px] sm:text-xs uppercase">
              Secure Portal Access
            </h2>
            
            <a href="/about" className="w-fit px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-full bg-[#F16524] text-white shadow-md hover:scale-105 transition-transform flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              Powered by IWS
            </a>
          </div>
        </div>

        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2.5 bg-[#F16524] rounded-2xl shadow-sm text-white hover:bg-[#d9581c] transition-colors"
          aria-label="Menu"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </nav>

      {/* MOBILE MENU OVERLAY */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div 
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
        
        <div 
          className={`absolute top-0 right-0 h-full w-full sm:w-[380px] bg-slate-900 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <span className="text-white font-bold text-lg ml-2">Electoral Explorer</span>
            </div>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-4 mt-8">
            <a 
              href="/about"
              className={`px-6 py-5 text-lg font-bold text-white rounded-2xl bg-white/10 shadow-xl transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-between ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: isMenuOpen ? '150ms' : '0ms' }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                Powered by IWS
              </div>
              <span>&rarr;</span>
            </a>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <a 
              href="/"
              className={`w-full py-4 rounded-full bg-white font-semibold text-base text-slate-900 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: isMenuOpen ? '450ms' : '0ms' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </a>
          </div>
        </div>
      </div>

      {/* CENTER VIDEO */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="relative w-[100vw] h-[60vh] sm:w-[70vw] sm:h-[70vh] md:w-[62vw] md:h-[78vh]">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-contain pointer-events-none mix-blend-multiply relative z-10"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260713_234424_b1332b69-2e69-4302-8dbc-40f86846afbd.mp4"
          />
        </div>
      </div>

      {/* BOTTOM ACTION */}
      <div className="relative z-30 pb-8 sm:pb-12 pt-4 px-6 flex flex-col items-center mt-auto">
        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-[90%] sm:w-auto min-w-[280px] bg-white text-slate-800 hover:bg-slate-50 border-2 border-slate-200 py-4 sm:py-5 px-8 rounded-full font-bold text-lg sm:text-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-4 hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isLoading ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 border-4 border-[#F16524] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
        </button>

        <a href="/" className="mt-8 text-slate-500 font-medium hover:text-slate-800 transition-colors flex items-center gap-2 group">
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to search
        </a>
      </div>
      
    </div>
  );
}
