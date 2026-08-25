'use client';
import React, { useState, useEffect } from 'react';
import { ReactTransliterate } from 'react-transliterate';
import 'react-transliterate/dist/index.css';
import DatabaseStatsModal from '@/components/DatabaseStatsModal';
import { useSession, signOut } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('voter_id');
  const [ward, setWard] = useState('');
  const [availableWards, setAvailableWards] = useState<number[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalVoters, setTotalVoters] = useState<number>(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [quotaError, setQuotaError] = useState<{message: string, code: string} | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Set initially
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const fetchWards = async () => {
    try {
      const res = await fetch('/api/wards');
      const json = await res.json();
      if (json.success) {
        setAvailableWards(json.data);
        if (json.totalVoters !== undefined) {
          setTotalVoters(json.totalVoters);
        }
      }
    } catch (err) {
      console.error('Failed to fetch wards', err);
    }
  };

  const fetchResults = async (searchQuery: string, type: string, wardQuery: string) => {
    setLoading(true);
    setQuotaError(null);
    setApiError(null);
    try {
      const res = await fetch(`/api/voters?q=${encodeURIComponent(searchQuery)}&type=${type}&ward=${encodeURIComponent(wardQuery)}`);
      const json = await res.json();
      
      if (res.status === 429) {
        setQuotaError({ message: json.error, code: json.code });
        setResults([]);
        setLoading(false);
        return;
      }
      
      if (res.status === 400 || res.status === 403) {
         setApiError(json.error);
         setResults([]);
         setLoading(false);
         return;
      }

      if (json.success) {
        setResults(json.data);
      } else {
        console.error('Error fetching data:', json.error);
        setApiError(json.error || 'An unexpected error occurred.');
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Initial fetches
    fetchWards();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults(query, searchType, ward);
  };

  return (
    <div className="min-h-screen bg-[#051424] text-[#d4e4fa] font-sans px-5 py-8 md:p-10 pt-16 md:pt-20 overflow-hidden relative">

      {/* Floating Marquee Promotion */}
      <div className="fixed top-0 left-0 w-full z-50 bg-[#0f172a]/30 backdrop-blur-md border-b border-white/5 py-2 overflow-hidden pointer-events-none">
        <div className="animate-marquee inline-block text-emerald-400/90 font-medium text-xs md:text-sm tracking-[0.2em] uppercase">
          <span className="opacity-70 mx-4">✨</span>  RK COACHING CLASSES <span className="opacity-70 mx-4">✨</span> RK COACHING CLASSES <span className="opacity-70 mx-4">✨</span>RK COACHING CLASSES <span className="opacity-70 mx-4">✨</span>RK COACHING CLASSES
        </div>
      </div>

      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-blue-600/20 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />

      <main className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 md:mb-12">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">Electoral Roll Search</h1>
            <p className="text-[#8c909f] mt-1 md:mt-2 text-sm md:text-base">Unofficial Secure Voter Lookup Portal</p>
          </div>
          <div className="flex gap-3 items-center self-start md:self-auto">
            <button 
              onClick={() => setShowStatsModal(true)}
              className="px-4 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs md:text-sm font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Live Database {totalVoters > 0 && <span className="opacity-80 ml-1">({totalVoters.toLocaleString()} Records)</span>}
              <svg className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {session ? (
              <button 
                onClick={() => signOut()}
                className="px-4 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs md:text-sm font-medium flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Logout
              </button>
            ) : (
              <a 
                href="/login"
                className="px-4 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs md:text-sm font-medium flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                Login
              </a>
            )}
          </div>
        </header>

        {/* Database Stats Modal */}
        <DatabaseStatsModal 
          isOpen={showStatsModal} 
          onClose={() => setShowStatsModal(false)} 
        />
            
        {/* Conditional rendering to prevent duplicate DOM issues with ReactTransliterate */}
        {isMobile === null ? (
          <div className="h-48 md:h-96 flex items-center justify-center opacity-50">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : !isMobile ? (
          <section className="relative w-full max-w-4xl mx-auto mb-12 flex justify-center items-center group">
            {/* Mascot Background */}
            <div className="relative w-full max-w-3xl mx-auto transition-transform duration-500 scale-110 origin-top -mt-20 lg:-mt-32 -mb-32 z-10">
              <img 
                src="/mascot_transparent.png" 
                alt="Search Mascot" 
                className="w-full h-auto opacity-90 block pointer-events-none"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 72%, transparent 82%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 72%, transparent 82%)'
                }}
              />
              
              {/* Interactive Tablet Overlay (Exactly mapping the tablet coordinates) */}
              <div className="absolute flex flex-col justify-center items-center" style={{ top: '44%', left: '32%', width: '37%', height: '26%' }}>
                <div className="w-full h-full flex flex-col justify-center px-1">
                  
                  <form onSubmit={handleSearch} className="flex flex-col gap-1.5 w-full">
                    <div className="relative">
                      <ReactTransliterate
                        value={query}
                        onChangeText={(text) => setQuery(text)}
                        lang="hi"
                        placeholder="Search..."
                        containerClassName={`w-full ${query.length === 0 ? 'hide-suggestions' : ''}`}
                        className="w-full bg-white/70 border-b border-gray-300 rounded h-7 px-1 text-gray-900 focus:outline-none focus:border-blue-500 text-xs font-medium leading-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-0.5">
                      <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                        className="w-full bg-white/70 border-b border-gray-300 rounded h-7 px-0.5 text-gray-900 focus:outline-none focus:border-blue-500 text-xs font-medium leading-none"
                      >
                        <option value="voter_id">Voter ID</option>
                        <option value="name" disabled>Name (Login Required)</option>
                        <option value="house" disabled>House No. (Login Required)</option>
                        <option value="serial" disabled>Serial No. (Login Required)</option>
                      </select>
                      
                      <select
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        className="w-full bg-white/70 border-b border-gray-300 rounded h-7 px-0.5 text-gray-900 focus:outline-none focus:border-blue-500 text-xs font-medium leading-none"
                      >
                        <option value="">All Wards</option>
                        {availableWards.map(w => (
                          <option key={w} value={w.toString()}>Ward {w}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded shadow-md hover:shadow-lg transition-all disabled:opacity-50 h-7 w-full text-xs"
                    >
                      {loading ? '...' : 'SEARCH'}
                    </button>
                  </form>

                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 rounded-xl p-5 mb-8 shadow-2xl">
          <form onSubmit={handleSearch} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 items-stretch">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#c2c6d6] mb-2 uppercase tracking-wider">Search Query</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <svg className="h-5 w-5 text-[#8c909f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <ReactTransliterate
                    value={query}
                    onChangeText={(text) => setQuery(text)}
                    lang="hi"
                    placeholder="Search in Hindi (Type English)..."
                    containerClassName={`w-full ${query.length === 0 ? 'hide-suggestions' : ''}`}
                    className="w-full bg-[#051424]/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#8c909f] text-sm"
                  />
                </div>
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-[#c2c6d6] mb-2 uppercase tracking-wider">Filter By</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-full bg-[#051424]/50 border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none text-sm"
                >
                  <option value="voter_id">Voter ID</option>
                  <option value="name">Name / Relative Name</option>
                  <option value="house">House Number</option>
                  <option value="serial">Serial Number</option>
                </select>
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-[#c2c6d6] mb-2 uppercase tracking-wider">Ward No.</label>
                <select
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full bg-[#051424]/50 border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none text-sm"
                >
                  <option value="">All</option>
                  {availableWards.map(w => (
                    <option key={w} value={w.toString()}>{w}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-8 rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all disabled:opacity-50 h-[48px] w-full mt-2 text-sm"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Results Section */}
        {quotaError ? (
          <section className="bg-gradient-to-br from-[#0f172a]/90 to-[#1e293b]/90 backdrop-blur-xl border border-red-500/30 rounded-xl p-8 mb-8 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Search Limit Reached</h2>
            <p className="text-[#c2c6d6] text-sm md:text-base mb-6 max-w-lg mx-auto">
              {quotaError.code === 'QUOTA_EXCEEDED_PUBLIC' 
                ? "You have used your 2 free public searches for today. To unlock more searches, please login securely using your Google Account."
                : "Your guest search quota is exhausted. To get unlimited premium access to the entire electoral roll database, please contact the administrator or RK Coaching Classes to upgrade your account."}
            </p>
            {quotaError.code === 'QUOTA_EXCEEDED_PUBLIC' && !session ? (
              <button onClick={() => window.location.href = '/api/auth/signin'} className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-white text-gray-900 font-bold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:scale-105 transform">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                Sign in with Google
              </button>
            ) : (
              <div className="inline-block bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 font-medium">Contact: Admin at RK Coaching Classes</p>
                <p className="text-sm text-blue-200/70 mt-1">Upgrade your account for unlimited ward access</p>
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Results ({results.length})</h2>
            </div>
            
            {apiError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <p className="font-medium text-red-300">Search Restricted</p>
                  <p className="text-sm mt-1">{apiError}</p>
                </div>
              </div>
            )}

          <div className="bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="uppercase tracking-wider border-b border-white/5 bg-[#1e293b]/50 text-[#8c909f]">
                  <tr>
                    <th scope="col" className="hidden sm:table-cell px-6 py-4 font-medium text-center">Ward</th>
                    <th scope="col" className="hidden sm:table-cell px-6 py-4 font-medium text-center">Page No.</th>
                    <th scope="col" className="hidden lg:table-cell px-6 py-4 font-medium">Source File</th>
                    <th scope="col" className="px-6 py-4 font-medium">Serial No.</th>
                    <th scope="col" className="px-4 md:px-6 py-4 font-medium">Name (Hindi)</th>
                    <th scope="col" className="px-4 md:px-6 py-4 font-medium">Voter ID</th>
                    <th scope="col" className="hidden md:table-cell px-6 py-4 font-medium">Relative's Name</th>
                    <th scope="col" className="hidden lg:table-cell px-6 py-4 font-medium">Relation</th>
                    <th scope="col" className="hidden sm:table-cell px-4 md:px-6 py-4 font-medium text-center">Age</th>
                    <th scope="col" className="hidden sm:table-cell px-4 md:px-6 py-4 font-medium">Gender</th>
                    <th scope="col" className="hidden md:table-cell px-6 py-4 font-medium">House No.</th>
                    <th scope="col" className="sm:hidden px-4 py-4 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.length > 0 ? (
                    results.map((voter) => (
                      <React.Fragment key={voter.id}>
                      <tr className="hover:bg-white/5 transition-colors cursor-pointer sm:cursor-default" onClick={() => { if(window.innerWidth < 640) toggleRow(voter.id) }}>
                        <td className="hidden sm:table-cell px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-sm shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                            {voter.ward || '-'}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-center font-mono text-[#8c909f]">
                          {voter.page_number || '-'}
                        </td>
                        <td className="hidden lg:table-cell px-6 py-4 text-xs font-mono text-[#8c909f] max-w-[150px] truncate" title={voter.source_file}>
                          {voter.source_file || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-sm shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {voter.serial_number}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 font-semibold text-blue-200">{voter.name_hi}</td>
                        <td className="px-4 md:px-6 py-4">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 font-mono text-sm tracking-wide">
                            {voter.voter_id}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-[#d4e4fa]">{voter.relative_name_hi}</td>
                        <td className="hidden lg:table-cell px-6 py-4 text-[#8c909f] capitalize">{voter.relative_type}</td>
                        <td className="hidden sm:table-cell px-4 md:px-6 py-4 text-center font-mono text-white/90">{voter.age}</td>
                        <td className="hidden sm:table-cell px-4 md:px-6 py-4 capitalize">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold ${voter.gender === 'male' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                            voter.gender === 'female' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                              'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>
                            {voter.gender}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 font-mono text-[#8c909f]">{voter.house_number}</td>
                        <td className="sm:hidden px-4 py-4 text-right text-[#8c909f]">
                          <svg className={`w-5 h-5 inline-block transition-transform ${expandedRows.has(voter.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </td>
                      </tr>
                      {expandedRows.has(voter.id) && (
                        <tr className="sm:hidden bg-white/[0.02]">
                          <td colSpan={4} className="px-4 py-4 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Ward</span> <span className="font-bold text-red-400">{voter.ward || '-'}</span></div>
                              <div><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Page No.</span> <span className="font-mono text-[#d4e4fa]">{voter.page_number || '-'}</span></div>
                              <div><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Age</span> <span className="font-mono text-[#d4e4fa]">{voter.age}</span></div>
                              <div><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Gender</span> <span className="capitalize text-[#d4e4fa]">{voter.gender}</span></div>
                              <div className="col-span-2"><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Relative ({voter.relative_type})</span> <span className="text-[#d4e4fa]">{voter.relative_name_hi}</span></div>
                              <div className="col-span-2"><span className="text-[#8c909f] text-xs uppercase block mb-0.5">House No.</span> <span className="font-mono text-[#d4e4fa]">{voter.house_number}</span></div>
                              <div className="col-span-2"><span className="text-[#8c909f] text-xs uppercase block mb-0.5">Source File</span> <span className="font-mono text-xs text-[#8c909f] break-all">{voter.source_file || '-'}</span></div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-[#8c909f]">
                        {loading ? 'Searching database...' : 'No records found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}
      </main>

      <footer className="relative z-10 mt-16 pb-8 text-center text-[#8c909f] text-sm">
        <p>© 2026 Voter_Scrapper (Election) </p>
        <p className="mt-1">
          Powered by <a href="#" onClick={(e) => { e.preventDefault(); window.open('file:///C:/Users/Shubh/OneDrive/Desktop/IMPOSTER/index.html', '_blank') }} className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors font-medium">Imposter's world ( RK COACHING CLASSES  )</a>
        </p>
      </footer>
    </div>
  );
}
