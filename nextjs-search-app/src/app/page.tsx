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
  const [quotaError, setQuotaError] = useState<{ message: string, code: string } | null>(null);
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
        if (json.error === 'Public users can only search by Voter ID. Please sign in with Google to search by Name.') {
          window.location.href = '/login';
          return;
        }
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
    if (!query.trim()) {
      setApiError('Please enter a valid search term before executing a query.');
      setResults([]);
      return;
    }
    fetchResults(query, searchType, ward);
  };

  return (
    <div className="min-h-screen bg-[#E9E1CC] text-[#24211A] font-['Lora'] px-5 py-8 md:p-10 pt-16 md:pt-20 relative">

      <style dangerouslySetInnerHTML={{
        __html: `
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
      <div className="iws-noise-overlay fixed inset-0 pointer-events-none z-10"></div>

      {/* Floating Marquee Promotion */}
      <div className="fixed top-0 left-0 w-full z-50 bg-[#1E2A42] border-b-2 border-double border-[#6B6944] py-2 md:py-3 overflow-hidden pointer-events-none shadow-[0_4px_10px_rgba(30,42,66,0.2)]">
        <div className="animate-marquee inline-block text-[#E9E1CC] font-['Courier_Prime'] font-bold text-sm md:text-base tracking-[0.2em] uppercase whitespace-nowrap">
          <span className="mx-6 text-[#A2382B]">✦</span>
          RK COACHING CLASSES
          <span className="mx-6 text-[#A2382B]">✦</span>
          A DECADE OF EMPIRICAL EXCELLENCE
          <span className="mx-6 text-[#A2382B]">✦</span>
          RK COACHING CLASSES
          <span className="mx-6 text-[#A2382B]">✦</span>
          A DECADE OF EMPIRICAL EXCELLENCE
        </div>
      </div>

      <main className="max-w-6xl mx-auto relative z-20">

        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 md:mb-12 border-b-[3px] border-double border-[#1E2A42] pb-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-[#1E2A42] font-['Fraunces'] tracking-tight">Electoral Roll Explorer</h1>
            <p className="text-[#4A4536] mt-1 md:mt-2 text-sm md:text-base font-['Courier_Prime'] tracking-widest uppercase">Unofficial Secure Voter Lookup Portal</p>
          </div>
          <div className="flex gap-3 items-center self-start md:self-auto font-['Courier_Prime']">
            <button
              onClick={() => setShowStatsModal(true)}
              className="px-4 py-2 bg-[#E1D7BC] border border-[#1E2A42] text-[#1E2A42] text-xs md:text-sm font-bold flex items-center gap-2 shadow-[2px_2px_0_rgba(30,42,66,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0_rgba(30,42,66,1)] transition-all uppercase tracking-wider"
            >
              <span className="w-2 h-2 rounded-full bg-[#A2382B] animate-pulse"></span>
              Live Database {totalVoters > 0 && <span className="opacity-80 ml-1">({totalVoters.toLocaleString()} Records)</span>}
            </button>
            {session ? (
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-[#A2382B] border border-[#A2382B] text-[#E9E1CC] text-xs md:text-sm font-bold flex items-center gap-2 shadow-[2px_2px_0_rgba(30,42,66,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0_rgba(30,42,66,1)] transition-all uppercase tracking-wider"
              >
                Logout
              </button>
            ) : (
              <a
                href="/login"
                className="px-4 py-2 bg-[#1E2A42] border border-[#1E2A42] text-[#E9E1CC] text-xs md:text-sm font-bold flex items-center gap-2 shadow-[2px_2px_0_rgba(30,42,66,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0_rgba(30,42,66,1)] transition-all uppercase tracking-wider"
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

        <section className="bg-gradient-to-b from-[#E1D7BC] to-[#D8CCA9] border border-[#1E2A42] p-5 mb-8 shadow-[5px_5px_0_rgba(30,42,66,0.12)] relative">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#6B6944]"></div>
          <form onSubmit={handleSearch} className="flex flex-col gap-5 pl-2">
            <div className="flex flex-col md:flex-row gap-4 items-stretch font-['Courier_Prime']">
              <div className="flex-[2]">
                <label className="block text-xs font-bold text-[#6B6944] mb-2 uppercase tracking-widest">Search Query</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <svg className="h-5 w-5 text-[#1E2A42]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchType === 'name' ? (
                    <ReactTransliterate
                      value={query}
                      onChangeText={(text) => setQuery(text)}
                      lang="hi"
                      placeholder="Search in Hindi (Type English)..."
                      containerClassName={`w-full ${query.length === 0 ? 'hide-suggestions' : ''}`}
                      className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 pl-10 pr-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all placeholder:text-[#4A4536]/50 text-sm shadow-inner rounded-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 pl-10 pr-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all placeholder:text-[#4A4536]/50 text-sm shadow-inner rounded-none"
                    />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-[#6B6944] mb-2 uppercase tracking-widest">Filter By</label>
                <select
                  value={searchType}
                  onChange={(e) => {
                    if (!session && e.target.value !== 'voter_id') {
                      window.location.href = '/login';
                      return;
                    }
                    setSearchType(e.target.value);
                  }}
                  className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 px-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all appearance-none text-sm shadow-inner rounded-none cursor-pointer"
                >
                  <option value="voter_id">Voter ID</option>
                  <option value="name">Name / Relative (Login)</option>
                  <option value="house">House Number (Login)</option>
                  <option value="serial">Serial Number (Login)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-[#6B6944] mb-2 uppercase tracking-widest">Ward No.</label>
                <select
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 px-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all appearance-none text-sm shadow-inner rounded-none cursor-pointer"
                >
                  <option value="">All Wards</option>
                  {availableWards.map(w => (
                    <option key={w} value={w.toString()}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#1E2A42] text-[#E9E1CC] font-bold py-3 px-8 shadow-[3px_3px_0_rgba(107,105,68,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[2px_2px_0_rgba(107,105,68,1)] transition-all disabled:opacity-50 h-[48px] w-full md:w-auto uppercase tracking-widest text-sm border border-[#1E2A42]"
                >
                  {loading ? 'Searching' : 'Search'}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Results Section */}
        {quotaError ? (
          <section className="bg-gradient-to-b from-[#E1D7BC] to-[#D8CCA9] border border-[#A2382B] p-8 mb-8 shadow-[5px_5px_0_rgba(162,56,43,0.2)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#A2382B]"></div>
            <div className="w-16 h-16 bg-[#A2382B]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#A2382B]">
              <svg className="w-8 h-8 text-[#A2382B]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-[#1E2A42] mb-3 font-['Fraunces']">Search Limit Reached</h2>
            <p className="text-[#4A4536] text-sm md:text-base mb-6 max-w-lg mx-auto">
              {quotaError.code === 'QUOTA_EXCEEDED_PUBLIC'
                ? "You have used your 2 free public searches for today. To unlock more searches, please login securely using your Google Account."
                : "Your guest search quota is exhausted. To get unlimited premium access to the entire electoral roll database, please contact the administrator or RK Coaching Classes to upgrade your account."}
            </p>
            {quotaError.code === 'QUOTA_EXCEEDED_PUBLIC' && !session ? (
              <button onClick={() => window.location.href = '/api/auth/signin'} className="inline-flex items-center justify-center px-8 py-3 bg-[#E9E1CC] border border-[#1E2A42] text-[#1E2A42] font-['Courier_Prime'] font-bold tracking-widest uppercase hover:bg-white transition-colors shadow-[3px_3px_0_rgba(30,42,66,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[2px_2px_0_rgba(30,42,66,1)]">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /><path fill="none" d="M1 1h22v22H1z" /></svg>
                Sign in with Google
              </button>
            ) : (
              <div className="inline-block bg-[#E9E1CC] border border-[#1E2A42] p-4 shadow-[2px_2px_0_rgba(30,42,66,1)]">
                <p className="text-[#1E2A42] font-bold font-['Courier_Prime']">Contact: Admin at RK Coaching Classes</p>
                <p className="text-sm text-[#4A4536] mt-1">Upgrade your account for unlimited ward access</p>
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="flex items-baseline gap-[14px] mt-12 mb-2 pb-2.5 border-b-[1.5px] border-[#1E2A42]">
              <span className="font-['Courier_Prime'] text-[12px] font-bold tracking-[0.14em] text-[#1E2A42] bg-[#E1D7BC] border border-[#1E2A42] px-2 py-[3px] whitespace-nowrap">Annexure B</span>
              <h2 className="font-['Fraunces'] font-medium text-[22px] m-0 text-[#24211A]">Search Results ({results.length})</h2>
            </div>
            <p className="font-['Courier_Prime'] text-[12px] text-[#4A4536] mt-2 mb-6">Live query output from the electoral database.</p>

            {apiError && (
              <div className="mb-6 p-4 bg-[#E1D7BC] border-l-[6px] border-[#A2382B] shadow-[2px_2px_0_rgba(30,42,66,0.1)] flex items-start gap-3 text-[#A2382B]">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <p className="font-bold text-[#A2382B] font-['Courier_Prime'] uppercase">Search Restricted</p>
                  <p className="text-sm mt-1 text-[#24211A] font-['Lora']">{apiError}</p>
                </div>
              </div>
            )}

            <div className="bg-[#E1D7BC] border border-[#1E2A42] shadow-[5px_5px_0_rgba(30,42,66,0.12)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="uppercase tracking-widest border-b-[2px] border-[#1E2A42] bg-[#1E2A42] text-[#E9E1CC] font-['Courier_Prime'] text-xs">
                    <tr>
                      <th scope="col" className="hidden sm:table-cell px-6 py-4 font-bold text-center">Ward</th>
                      <th scope="col" className="hidden sm:table-cell px-6 py-4 font-bold text-center">Page</th>
                      <th scope="col" className="hidden lg:table-cell px-6 py-4 font-bold">Source File</th>
                      <th scope="col" className="px-6 py-4 font-bold">Serial No.</th>
                      <th scope="col" className="px-4 md:px-6 py-4 font-bold">Name (Hindi)</th>
                      <th scope="col" className="px-4 md:px-6 py-4 font-bold">Voter ID</th>
                      <th scope="col" className="hidden md:table-cell px-6 py-4 font-bold">Relative's Name</th>
                      <th scope="col" className="hidden lg:table-cell px-6 py-4 font-bold">Relation</th>
                      <th scope="col" className="hidden sm:table-cell px-4 md:px-6 py-4 font-bold text-center">Age</th>
                      <th scope="col" className="hidden sm:table-cell px-4 md:px-6 py-4 font-bold">Gender</th>
                      <th scope="col" className="hidden md:table-cell px-6 py-4 font-bold">House No.</th>
                      <th scope="col" className="sm:hidden px-4 py-4 font-bold text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7A97E]">
                    {results.length > 0 ? (
                      results.map((voter) => (
                        <React.Fragment key={voter.id}>
                          <tr className="hover:bg-[#D8CCA9] transition-colors cursor-pointer sm:cursor-default" onClick={() => { if (window.innerWidth < 640) toggleRow(voter.id) }}>
                            <td className="hidden sm:table-cell px-6 py-4 text-center font-['Courier_Prime']">
                              <span className="inline-block px-2 py-0.5 bg-[#A2382B]/10 text-[#A2382B] border border-[#A2382B] font-bold">
                                {voter.ward || '-'}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell px-6 py-4 text-center font-['Courier_Prime'] text-[#1E2A42] font-bold">
                              {voter.page_number || '-'}
                            </td>
                            <td className="hidden lg:table-cell px-6 py-4 text-xs font-['Courier_Prime'] text-[#4A4536] max-w-[150px] truncate" title={voter.source_file}>
                              {voter.source_file || '-'}
                            </td>
                            <td className="px-6 py-4 font-['Courier_Prime']">
                              <span className="inline-block px-2 py-0.5 bg-[#1E2A42]/10 text-[#1E2A42] border border-[#1E2A42] font-bold">
                                {voter.serial_number}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-4 font-bold text-[#1E2A42]">{voter.name_hi}</td>
                            <td className="px-4 md:px-6 py-4 font-['Courier_Prime']">
                              <span className="inline-block px-2 py-0.5 text-[#1E2A42] border border-dotted border-[#1E2A42] font-bold tracking-wide">
                                {voter.voter_id}
                              </span>
                            </td>
                            <td className="hidden md:table-cell px-6 py-4 text-[#4A4536] font-medium">{voter.relative_name_hi}</td>
                            <td className="hidden lg:table-cell px-6 py-4 text-[#6B6944] capitalize font-['Courier_Prime'] text-xs">{voter.relative_type}</td>
                            <td className="hidden sm:table-cell px-4 md:px-6 py-4 text-center font-['Courier_Prime'] font-bold text-[#1E2A42]">{voter.age}</td>
                            <td className="hidden sm:table-cell px-4 md:px-6 py-4 capitalize font-['Courier_Prime'] text-xs">
                              <span className={`inline-block px-2 py-0.5 font-bold border ${voter.gender === 'male' ? 'bg-[#1E2A42]/10 text-[#1E2A42] border-[#1E2A42]' :
                                voter.gender === 'female' ? 'bg-[#A2382B]/10 text-[#A2382B] border-[#A2382B]' :
                                  'bg-[#6B6944]/10 text-[#6B6944] border-[#6B6944]'
                                }`}>
                                {voter.gender}
                              </span>
                            </td>
                            <td className="hidden md:table-cell px-6 py-4 font-['Courier_Prime'] text-[#1E2A42] font-bold">{voter.house_number}</td>
                            <td className="sm:hidden px-4 py-4 text-right text-[#1E2A42]">
                              <svg className={`w-5 h-5 inline-block transition-transform ${expandedRows.has(voter.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </td>
                          </tr>
                          {expandedRows.has(voter.id) && (
                            <tr className="sm:hidden bg-[#E9E1CC]">
                              <td colSpan={4} className="px-4 py-4 border-t border-dashed border-[#1E2A42]">
                                <div className="grid grid-cols-2 gap-3 text-sm font-['Courier_Prime']">
                                  <div><span className="text-[#6B6944] text-xs uppercase block mb-0.5">Ward</span> <span className="font-bold text-[#A2382B]">{voter.ward || '-'}</span></div>
                                  <div><span className="text-[#6B6944] text-xs uppercase block mb-0.5">Page No.</span> <span className="font-bold text-[#1E2A42]">{voter.page_number || '-'}</span></div>
                                  <div><span className="text-[#6B6944] text-xs uppercase block mb-0.5">Age</span> <span className="font-bold text-[#1E2A42]">{voter.age}</span></div>
                                  <div><span className="text-[#6B6944] text-xs uppercase block mb-0.5">Gender</span> <span className="capitalize font-bold text-[#1E2A42]">{voter.gender}</span></div>
                                  <div className="col-span-2 font-['Lora']"><span className="text-[#6B6944] text-xs uppercase block mb-0.5 font-['Courier_Prime']">Relative ({voter.relative_type})</span> <span className="font-bold text-[#1E2A42]">{voter.relative_name_hi}</span></div>
                                  <div className="col-span-2"><span className="text-[#6B6944] text-xs uppercase block mb-0.5">House No.</span> <span className="font-bold text-[#1E2A42]">{voter.house_number}</span></div>
                                  <div className="col-span-2"><span className="text-[#6B6944] text-xs uppercase block mb-0.5">Source File</span> <span className="text-xs text-[#4A4536] break-all">{voter.source_file || '-'}</span></div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} className="px-6 py-16 text-center font-['Courier_Prime'] text-[#4A4536]">
                          {loading ? 'SEARCHING ARCHIVES...' : 'NO RECORDS FOUND IN CURRENT FILE.'}
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

      <footer className="relative z-20 mt-16 pb-8 pt-8 flex flex-col items-center justify-center gap-4 text-[#4A4536] text-sm border-t-[3px] border-double border-[#1E2A42] font-['Courier_Prime'] max-w-6xl mx-auto w-full">
        <p className="uppercase tracking-widest font-bold">© 2026 Voter_Scrapper (Election)</p>
        <div className="flex items-center gap-4 text-xs font-bold tracking-widest uppercase">
          <a href="/about" className="text-[#1E2A42] hover:text-[#A2382B] transition-colors border-b-[1.5px] border-[#1E2A42] hover:border-[#A2382B] pb-[2px]">
            Imposter World Services
          </a>
          <span className="text-[#B7A97E]">|</span>
          <a href="/about" className="text-[#1E2A42] hover:text-[#A2382B] transition-colors border-b-[1.5px] border-[#1E2A42] hover:border-[#A2382B] pb-[2px]">
            Legal & Notices
          </a>
        </div>
      </footer>
    </div>
  );
}
