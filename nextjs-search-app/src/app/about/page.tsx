"use client";

import React from 'react';
import { ArrowLeft, Code, Mail, Globe, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white overflow-hidden relative selection:bg-[#F16524] selection:text-white">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#F16524]/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-[#8c909f] hover:text-white mb-12 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </Link>

        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#F16524] to-[#FF9642] shadow-[0_0_40px_rgba(241,101,36,0.3)] mb-6">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            Imposter World Services
          </h1>
          <p className="text-xl md:text-2xl text-[#8c909f] font-medium">
            Building the Future of Digital Search
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* IWS Card */}
          <div className="bg-[#1e293b]/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F16524] to-[#FF9642] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-[#F16524]/10 rounded-2xl text-[#F16524]">
                <Globe className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">About IWS</h2>
            </div>
            <p className="text-[#8c909f] leading-relaxed mb-6">
              Imposter World Services (IWS) is a cutting-edge development agency focused on creating lightning-fast, ultra-secure web applications. Our mission is to transform complex datasets into accessible, beautifully designed user interfaces.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <ShieldCheck className="w-5 h-5 text-[#F16524]" />
                Military-grade data security
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <Code className="w-5 h-5 text-[#F16524]" />
                Next.js & React architecture
              </li>
            </ul>
          </div>

          {/* Developer Card */}
          <div className="bg-[#1e293b]/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                <Code className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">The Developer</h2>
            </div>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">Shubham Agrawal</h3>
              <h4 className="text-sm font-medium text-white/70 mb-2">s/o Rakesh Kumar Agrawal</h4>
              <p className="text-[#F16524] font-medium text-sm">Lead Software Engineer & Architect</p>
            </div>

            <p className="text-[#8c909f] leading-relaxed mb-8">
              Specializing in full-stack web development, scalable databases, and modern UI/UX design. Creator of the Electoral Roll Explorer platform.
            </p>

            <a 
              href="mailto:rk.coachings20@gmail.com" 
              className="inline-flex items-center justify-center w-full gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all hover:scale-[1.02]"
            >
              <Mail className="w-5 h-5" />
              Contact the Developer
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-[#8c909f] text-sm font-medium">
          <p>© {new Date().getFullYear()} Imposter World Services. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
