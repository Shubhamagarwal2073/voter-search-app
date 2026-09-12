'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DutyPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('gali');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/duty?q=${encodeURIComponent(query)}&filter=${searchType}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
      } else {
        setError(json.error);
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch duty candidates.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#E9E1CC] text-[#24211A] font-['Lora'] px-5 py-8 md:p-10 pt-16 md:pt-20 relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');
      `}} />

      <main className="max-w-6xl mx-auto relative z-20">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 md:mb-12 border-b-[3px] border-double border-[#1E2A42] pb-6">
          <div className="relative inline-block pr-32 md:pr-48">
            <h1 className="text-2xl md:text-4xl font-black text-[#1E2A42] font-['Fraunces'] tracking-tight inline-block relative">
              Duty Roster Portal
            </h1>
            <p className="text-[#4A4536] mt-1 md:mt-2 text-sm md:text-base font-['Courier_Prime'] tracking-widest uppercase relative z-20">Find Duty Incharges by Gali / Block</p>
          </div>
          <div className="flex gap-3 items-center self-start md:self-auto font-['Courier_Prime']">
            <Link href="/" className="px-4 py-2 bg-[#1E2A42] border border-[#1E2A42] text-[#E9E1CC] text-xs md:text-sm font-bold flex items-center gap-2 shadow-[2px_2px_0_rgba(30,42,66,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0_rgba(30,42,66,1)] transition-all uppercase tracking-wider">
              Home Portal
            </Link>
          </div>
        </header>

        <section className="bg-gradient-to-b from-[#E1D7BC] to-[#D8CCA9] border border-[#1E2A42] p-5 mb-8 shadow-[5px_5px_0_rgba(30,42,66,0.12)] relative">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#6B6944]"></div>
          <form onSubmit={handleSearch} className="flex flex-col gap-5 pl-2">
            <div className="flex flex-col md:flex-row gap-4 items-stretch font-['Courier_Prime']">
              <div className="flex-[2]">
                <label className="block text-xs font-bold text-[#6B6944] mb-2 uppercase tracking-widest">Search Query</label>
                <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search Gali or Block..."
                      className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 pl-4 pr-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all placeholder:text-[#4A4536]/50 text-sm shadow-inner rounded-none"
                    />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-[#6B6944] mb-2 uppercase tracking-widest">Filter By</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-full bg-[#E9E1CC] border border-[#1E2A42] py-3 px-4 text-[#1E2A42] focus:outline-none focus:ring-1 focus:ring-[#A2382B] transition-all appearance-none text-sm shadow-inner rounded-none cursor-pointer"
                >
                  <option value="gali">Gali Name</option>
                  <option value="block">Block Name</option>
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

        <section>
            <div className="flex items-baseline gap-[14px] mt-12 mb-2 pb-2.5 border-b-[1.5px] border-[#1E2A42]">
              <h2 className="font-['Fraunces'] font-medium text-[22px] m-0 text-[#24211A]">Duty Candidates ({results.length})</h2>
            </div>
            
            {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

            <div className="bg-[#E1D7BC] border border-[#1E2A42] shadow-[5px_5px_0_rgba(30,42,66,0.12)] overflow-hidden mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="uppercase tracking-widest border-b-[2px] border-[#1E2A42] bg-[#1E2A42] text-[#E9E1CC] font-['Courier_Prime'] text-xs">
                    <tr>
                      <th className="px-6 py-4 font-bold">Block</th>
                      <th className="px-6 py-4 font-bold">Gali</th>
                      <th className="px-6 py-4 font-bold">Duty Incharge</th>
                      <th className="px-6 py-4 font-bold">Role</th>
                      <th className="px-6 py-4 font-bold">Phone Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B7A97E] font-['Courier_Prime']">
                    {results.length > 0 ? (
                      results.map((r, i) => (
                        <tr key={i} className="hover:bg-[#D8CCA9] transition-colors">
                          <td className="px-6 py-4 font-bold">{r.block}</td>
                          <td className="px-6 py-4">{r.gali}</td>
                          <td className="px-6 py-4 text-[#A2382B] font-bold">
                            {r.duty_incharge_en && <div>{r.duty_incharge_en}</div>}
                            {r.duty_incharge_hi && r.duty_incharge_hi !== r.duty_incharge_en && <div>{r.duty_incharge_hi}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-normal min-w-[200px]">
                            {r.role_en && <div className="font-bold">{r.role_en}</div>}
                            {r.role_hi && r.role_hi !== r.role_en && <div className="text-[#6B6944] text-xs mt-1">{r.role_hi}</div>}
                          </td>
                          <td className="px-6 py-4">{r.phone}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-[#4A4536]">
                          NO DUTY RECORDS FOUND
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        </section>
      </main>
    </div>
  );
}
