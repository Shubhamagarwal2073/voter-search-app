"use client";

import React, { useEffect, useState, useRef } from 'react';
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
    <div className="w-full h-screen overflow-hidden flex flex-col bg-[#E9E1CC] relative text-[#24211A] font-['Lora']">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');

        .iws-noise-overlay::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          opacity: 0.05;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }
      `}} />

      {/* NOISE OVERLAY */}
      <div className="iws-noise-overlay absolute inset-0 pointer-events-none z-10"></div>

      {/* BACKGROUND "LOGIN" TEXT EFFECT */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] z-0"
      >
        <div className="relative flex items-center justify-center">
          <div 
            className="text-[#1E2A42] font-['Fraunces'] font-black leading-none tracking-tighter whitespace-nowrap"
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
      <nav className="relative z-20 flex flex-row items-center justify-between px-4 sm:px-6 md:px-12 py-4 sm:py-5 border-b-[3px] border-double border-[#1E2A42]/20">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#1E2A42] rounded-full border border-[#1E2A42]"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#1E2A42] rounded-full border border-[#1E2A42]"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#1E2A42] rounded-full border border-[#1E2A42]"></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#1E2A42] rounded-full border border-[#1E2A42]"></div>
            </div>
            <span className="text-[#1E2A42] font-['Fraunces'] font-bold text-xl sm:text-2xl tracking-tight leading-none">Electoral Explorer</span>
          </div>
          
          <div className="ml-8 flex flex-col items-start gap-2.5">
            <h2 className="text-[#4A4536] font-['Courier_Prime'] font-bold tracking-widest text-[10px] sm:text-xs uppercase">
              Secure Portal Access
            </h2>
            
            <a href="/about" className="w-fit px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-none border border-[#A2382B] bg-[#E1D7BC] text-[#A2382B] hover:bg-[#A2382B] hover:text-[#E9E1CC] transition-colors flex items-center gap-1.5 font-['Courier_Prime'] uppercase tracking-widest">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              Powered by IWS
            </a>
          </div>
        </div>

        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2.5 bg-[#A2382B] rounded-none border border-[#A2382B] shadow-[2px_2px_0_rgba(30,42,66,0.12)] text-[#E9E1CC] hover:bg-[#852a1e] transition-colors"
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
          className="absolute inset-0 bg-[#1E2A42]/40 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
        
        <div 
          className={`absolute top-0 right-0 h-full w-full sm:w-[380px] bg-[#E1D7BC] border-l-[6px] border-[#6B6944] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="p-6 flex items-center justify-between border-b-[1.5px] border-[#1E2A42]">
            <div className="flex items-center">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-2.5 h-2.5 bg-[#1E2A42] rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-[#1E2A42] rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-[#1E2A42] rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-[#1E2A42] rounded-full"></div>
              </div>
              <span className="text-[#1E2A42] font-['Fraunces'] font-bold text-lg ml-2">Electoral Explorer</span>
            </div>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-[#1E2A42]/10 text-[#1E2A42] flex items-center justify-center hover:bg-[#1E2A42]/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="p-6 flex flex-col gap-4 mt-8">
            <a 
              href="/about"
              className={`px-6 py-5 text-lg font-bold text-[#1E2A42] border border-[#1E2A42] bg-[#E9E1CC] shadow-[5px_5px_0_rgba(30,42,66,0.12)] transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-between font-['Courier_Prime'] uppercase tracking-widest ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: isMenuOpen ? '150ms' : '0ms' }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                Powered by IWS
              </div>
              <span>&rarr;</span>
            </a>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 border-t-[1.5px] border-[#1E2A42]">
            <a 
              href="/"
              className={`w-full py-4 border border-[#1E2A42] bg-[#E9E1CC] font-bold text-base text-[#1E2A42] font-['Courier_Prime'] uppercase tracking-widest flex items-center justify-center gap-2 hover:-translate-y-1 transition-transform duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: isMenuOpen ? '450ms' : '0ms' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
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
          className="w-[90%] sm:w-auto min-w-[280px] bg-[#E1D7BC] text-[#1E2A42] hover:bg-[#D8CCA9] border-[1.5px] border-[#1E2A42] py-4 sm:py-5 px-8 rounded-none font-bold text-sm sm:text-base font-['Courier_Prime'] tracking-widest uppercase shadow-[5px_5px_0_rgba(30,42,66,0.12)] transition-all duration-300 flex items-center justify-center gap-4 hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isLoading ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 border-4 border-[#A2382B] border-t-transparent rounded-full animate-spin"></div>
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

        <a href="/" className="mt-8 text-[#1E2A42] font-['Courier_Prime'] text-[12px] tracking-[0.06em] font-bold border-b-[1.5px] border-[#1E2A42] pb-[2px] hover:text-[#A2382B] hover:border-[#A2382B] transition-colors flex items-center gap-2 group">
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to search
        </a>
      </div>
      
    </div>
  );
}
