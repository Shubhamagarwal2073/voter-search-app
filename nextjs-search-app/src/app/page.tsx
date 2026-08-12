'use client';
import React, { useState, useEffect } from 'react';
import { ReactTransliterate } from 'react-transliterate';
import 'react-transliterate/dist/index.css';
import DatabaseStatsModal from '@/components/DatabaseStatsModal';

export default function Home() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [ward, setWard] = useState('');
  const [availableWards, setAvailableWards] = useState<number[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalVoters, setTotalVoters] = useState<number>(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showStatsModal, setShowStatsModal] = useState(false);

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
    try {
      const res = await fetch(`/api/voters?q=${encodeURIComponent(searchQuery)}&type=${type}&ward=${encodeURIComponent(wardQuery)}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
      } else {
        console.error('Error fetching data:', json.error);
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
    fetchResults('', 'name', '');
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
          <button 
            onClick={() => setShowStatsModal(true)}
            className="px-4 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs md:text-sm font-medium flex items-center gap-2 self-start md:self-auto shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            Live Database {totalVoters > 0 && <span className="opacity-80 ml-1">({totalVoters.toLocaleString()} Records)</span>}
            <svg className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </header>

        {/* Database Stats Modal */}
        <DatabaseStatsModal 
          isOpen={showStatsModal} 
          onClose={() => setShowStatsModal(false)} 
        />

        {/* Mascot Search Section */}
        <section className="relative w-full max-w-4xl mx-auto mb-12 flex justify-center items-center group">
          {/* Mascot Background */}
          <div className="relative w-full max-w-3xl mx-auto transition-transform duration-500 scale-[2.0] sm:scale-[1.8] md:scale-110 origin-top -mt-10 md:-mt-20 lg:-mt-32 mb-48 sm:mb-32 md:-mb-32 z-10">
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
                
                <form onSubmit={handleSearch} className="flex flex-col gap-0.5 md:gap-1.5 w-full">
                  <div className="relative">
                    <ReactTransliterate
                      value={query}
                      onChangeText={(text) => setQuery(text)}
                      lang="hi"
                      placeholder="Search..."
                      containerClassName="w-full"
                      className="w-full bg-white/70 border-b border-gray-300 rounded h-4 sm:h-5 md:h-7 px-1 text-gray-900 focus:outline-none focus:border-blue-500 text-[8px] sm:text-[9px] md:text-xs font-medium leading-none"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                      className="w-full bg-white/70 border-b border-gray-300 rounded h-4 sm:h-5 md:h-7 px-0.5 text-gray-900 focus:outline-none focus:border-blue-500 text-[8px] sm:text-[9px] md:text-xs font-medium leading-none"
                    >
                      <option value="name">Name</option>
                      <option value="voter_id">Voter ID</option>
                      <option value="house">House No.</option>
                      <option value="serial">Serial No.</option>
                    </select>
                    
                    <select
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      className="w-full bg-white/70 border-b border-gray-300 rounded h-4 sm:h-5 md:h-7 px-0.5 text-gray-900 focus:outline-none focus:border-blue-500 text-[8px] sm:text-[9px] md:text-xs font-medium leading-none"
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
                    className="mt-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold h-5 sm:h-6 md:h-8 px-1 rounded shadow transition-all disabled:opacity-50 text-[8px] sm:text-[9px] md:text-xs w-full uppercase leading-none flex items-center justify-center"
                  >
                    {loading ? '...' : 'Search'}
                  </button>
                </form>

              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Results ({results.length})</h2>
          </div>

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

        {/* Results Section */}
        {/* ... results table ... */}
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
