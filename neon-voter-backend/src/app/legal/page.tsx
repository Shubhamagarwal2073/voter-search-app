import React from "react";
import Link from "next/link";
import Head from "next/head";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#E9E1CC] text-[#24211A] font-['Lora'] py-16 px-6 relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');
      ` }} />
      
      {/* Background texture matching the about page */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-5 mix-blend-multiply" 
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'
        }}
      ></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="border-b-4 border-double border-[#1E2A42] pb-6 mb-12">
          <h1 className="text-4xl md:text-5xl font-['Fraunces'] font-semibold italic text-[#1E2A42] mb-4">
            Legal <span className="text-[#A2382B] font-normal">&amp;</span> Notices
          </h1>
          <p className="font-['Courier_Prime'] text-sm tracking-widest uppercase text-[#6B6944]">
            Important Disclaimers for Electoral Roll Explorer
          </p>
        </div>

        <div className="space-y-10">
          <section className="bg-[#E1D7BC] p-8 border border-[#1E2A42] relative shadow-[5px_5px_0_rgba(30,42,66,0.12)]">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#A2382B]"></div>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">1. Unofficial &amp; Independent Application</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              <strong>Electoral Roll Explorer (Voter_Scrapper) is an entirely independent, unofficial project.</strong> It is <strong>NOT</strong> affiliated with, endorsed by, sponsored by, or associated in any way with the Election Commission of India (ECI), any State Election Commission, or any other government department or agency. 
            </p>
            <p className="text-lg leading-relaxed text-[#4A4536]">
              This platform is built and maintained solely by an independent developer (Imposter World Services) to provide an alternative, optimized search interface for publicly available data.
            </p>
          </section>

          <section>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">2. Purpose &amp; Motive</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              During elections, it often becomes a massive struggle for citizens to find their names and polling booths in the heavy, difficult-to-read paper copies of the electoral roll. The sole motive of this application is to <strong>automate this task and help citizens</strong>. It is built as a public utility to empower volunteers at help desks to quickly guide voters and find their details instantly through intelligent search, eliminating the need to manually scratch through hundreds of physical pages. This tool is not intended for commercial exploitation or to replace official government portals.
            </p>
          </section>

          <section>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">3. Source of Information</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              The data searchable on this platform originates from publicly available electoral rolls that have been issued for public consumption. We do not generate, modify, author, or exclusively own this data. Our tool simply indexes and provides an advanced search layer over these existing public records to improve accessibility.
            </p>
          </section>

          <section>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">4. Accuracy, Completeness &amp; Liability</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              While we strive to provide an accurate and fast search experience, the information provided here is strictly on an &quot;as-is&quot; and &quot;as-available&quot; basis for informational purposes only. We make no representations, warranties, or guarantees of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or timeliness of the data.
            </p>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              Any reliance you place on such information is therefore strictly at your own risk. In no event will we be liable for any loss or damage including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this platform.
            </p>
          </section>

          <section>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">5. Official Reference Requirement</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              This tool must <strong>not</strong> be used as a substitute for official voter verification. For definitive, legally binding, and the most up-to-date electoral information—such as verifying voter eligibility, polling booth details, or personal information updates—users <strong>must</strong> refer to the official Election Commission of India website (<a href="https://eci.gov.in/" target="_blank" rel="noopener noreferrer" className="text-[#A2382B] underline font-bold hover:text-[#1E2A42] transition-colors">eci.gov.in</a>) or the respective official state portals.
            </p>
          </section>

          <section>
            <h2 className="font-['Fraunces'] text-2xl font-semibold mb-4 text-[#1E2A42]">6. Privacy and Data Usage</h2>
            <p className="text-lg leading-relaxed text-[#4A4536] mb-4">
              We respect user privacy and adhere to data protection guidelines regarding public records. This application does not track individual user searches for surveillance purposes, nor do we harvest, sell, or distribute user data. The platform functions merely as a read-only search index over data that is legally mandated to be in the public domain.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t-[3px] border-double border-[#1E2A42] flex justify-between items-center flex-wrap gap-4">
          <Link href="/" className="font-['Courier_Prime'] text-sm font-bold text-[#1E2A42] hover:text-[#A2382B] border-b-[1.5px] border-[#1E2A42] hover:border-[#A2382B] pb-[2px] transition-colors">
            &larr; RETURN TO SEARCH
          </Link>
          <div className="font-['Courier_Prime'] text-xs text-[#6B6944]">
            LAST UPDATED: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}
