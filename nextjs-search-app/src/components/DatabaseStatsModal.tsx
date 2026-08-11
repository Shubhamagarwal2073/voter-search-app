import React, { useState, useEffect } from 'react';

interface WardStat {
  ward: number;
  total: number;
  male: number;
  female: number;
  other: number;
  missing: number[];
}

interface DatabaseStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseStatsModal({ isOpen, onClose }: DatabaseStatsModalProps) {
  const [stats, setStats] = useState<WardStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWard, setExpandedWard] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/stats')
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            setStats(json.data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch stats", err);
          setLoading(false);
        });
    } else {
      setExpandedWard(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalVoters = stats.reduce((sum, stat) => sum + stat.total, 0);
  const totalMissing = stats.reduce((sum, stat) => sum + stat.missing.length, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 bg-black/60 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-full bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Ambient Glow */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#1e293b]/50">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Live Database Details
            </h2>
            <p className="text-sm text-[#8c909f] mt-1">
              Total Valid Voters: <strong className="text-[#d4e4fa]">{totalVoters.toLocaleString()}</strong> | Total Missing/Shifted: <strong className="text-red-300">{totalMissing.toLocaleString()}</strong>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-[#8c909f] hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#8c909f]">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p>Analyzing database segments...</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/10 rounded-xl bg-[#051424]/50">
              <table className="w-full text-left text-sm text-[#d4e4fa]">
                <thead className="uppercase tracking-wider border-b border-white/5 bg-[#1e293b]/50 text-[#8c909f]">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-medium text-center">Ward Name</th>
                    <th scope="col" className="px-6 py-4 font-medium text-center">Male</th>
                    <th scope="col" className="px-6 py-4 font-medium text-center">Female</th>
                    <th scope="col" className="px-6 py-4 font-medium text-center text-white">Total</th>
                    <th scope="col" className="px-6 py-4 font-medium text-right">Missing No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.map((stat) => (
                    <React.Fragment key={stat.ward}>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-sm shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                            Ward {stat.ward}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-sky-300">
                          {stat.male.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-pink-300">
                          {stat.female.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center font-bold font-mono text-white text-base">
                          {stat.total.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setExpandedWard(expandedWard === stat.ward ? null : stat.ward)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium text-sm transition-colors shadow-[0_0_10px_rgba(249,115,22,0.15)] group"
                          >
                            <span>{stat.missing.length} Missing</span>
                            <svg className={`w-4 h-4 transition-transform ${expandedWard === stat.ward ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </td>
                      </tr>
                      {/* Expanded Missing Numbers Row */}
                      {expandedWard === stat.ward && (
                        <tr className="bg-black/30 animate-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="px-6 py-5 border-t border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <h3 className="text-sm font-semibold text-orange-300 uppercase tracking-wide">
                                Missing / Shifted / Deleted Serial Numbers (1 to {stat.total + stat.missing.length})
                              </h3>
                            </div>
                            {stat.missing.length > 0 ? (
                              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto custom-scrollbar p-2 rounded-lg bg-[#051424] border border-white/5">
                                {stat.missing.map(num => (
                                  <span key={num} className="px-2 py-1 text-xs font-mono rounded bg-white/5 text-[#8c909f] border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-default">
                                    {num}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[#8c909f] text-sm italic py-2">No missing serial numbers. Flawless 1-to-1 extraction.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {stats.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[#8c909f]">No wards found in database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Global styles for custom scrollbar within modal */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}} />
    </div>
  );
}
