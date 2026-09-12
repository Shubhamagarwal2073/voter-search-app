"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
          }
        });
      },
      { threshold: 0.35 }
    );

    const idcard = containerRef.current?.querySelector("#idcard");
    const seal = containerRef.current?.querySelector("#seal");

    if (idcard) obs.observe(idcard);
    if (seal) obs.observe(seal);

    return () => obs.disconnect();
  }, []);

  return (
    <div className="iws-container" ref={containerRef}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');

        .iws-container {
          --paper: #E9E1CC;
          --paper-card: #E1D7BC;
          --paper-deep: #D8CCA9;
          --ink: #24211A;
          --ink-soft: #4A4536;
          --navy: #1E2A42;
          --stamp: #A2382B;
          --stamp-dim: #A2382B99;
          --olive: #6B6944;
          --line: #B7A97E;
          --line-soft: #C9BE97;

          min-height: 100vh;
          background:
            radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.35), transparent 55%),
            var(--paper);
          color: var(--ink);
          font-family: 'Lora', serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
          padding-bottom: 50px;
          margin-top: -64px; /* Adjust if you have a navbar to make it fullscreen, otherwise 0 */
          padding-top: 64px; 
        }

        .iws-container::before {
          content:"";
          position: absolute;
          inset:0;
          pointer-events:none;
          z-index: 50;
          opacity: 0.05;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .iws-container * { box-sizing: border-box; }

        @media (prefers-reduced-motion: reduce){
          .iws-container * { animation: none !important; transition: none !important; }
        }

        .iws-wrap {
          max-width: 880px;
          margin: 0 auto;
          padding: 0 28px;
          position: relative;
          z-index: 1;
        }

        .iws-container .mono { font-family: 'Courier Prime', monospace; }

        .iws-container .eyebrow {
          font-family: 'Courier Prime', monospace;
          font-size: 12.5px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--stamp);
          font-weight: 700;
        }

        /* ---------- Letterhead ---------- */
        .iws-container header.letterhead {
          border-bottom: 3px double var(--navy);
          padding: 22px 0 14px;
        }
        .iws-container header.letterhead .row {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .iws-container .brandmark {
          display:flex;
          align-items:center;
          gap: 14px;
        }
        .iws-container .brandmark .crest {
          width: 46px; height:46px; flex:0 0 auto;
          border-radius:50%;
          border: 2px solid var(--navy);
          display:flex; align-items:center; justify-content:center;
          font-family:'Fraunces', serif; font-weight:600; font-size:16px;
          color: var(--navy);
          background: var(--paper-card);
        }
        .iws-container .brandmark .name {
          font-family:'Fraunces', serif;
          font-weight: 600;
          font-size: 19px;
          letter-spacing: 0.03em;
          line-height:1.15;
        }
        .iws-container .brandmark .name small {
          display:block;
          font-family:'Courier Prime', monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: var(--ink-soft);
          font-weight: 400;
          margin-top: 3px;
        }
        .iws-container .filecode {
          font-family:'Courier Prime', monospace;
          font-size: 12px;
          color: var(--ink-soft);
          text-align:right;
          line-height:1.6;
        }

        /* ---------- Hero ---------- */
        .iws-container .hero {
          padding: 64px 0 40px;
          position: relative;
        }
        .iws-container .hero h1 {
          font-family:'Fraunces', serif;
          font-weight: 500;
          font-style: italic;
          font-size: clamp(28px, 4.6vw, 44px);
          line-height: 1.22;
          margin: 14px 0 22px;
          max-width: 15ch;
          color: var(--ink);
        }
        .iws-container .hero h1 em {
          font-style: normal;
          font-weight: 600;
          color: var(--stamp);
        }
        .iws-container .hero p.lede {
          max-width: 54ch;
          font-size: 17px;
          line-height: 1.7;
          color: var(--ink-soft);
        }
        .iws-container .hero .facts {
          margin-top: 30px;
          display:grid;
          grid-template-columns: repeat(3, auto);
          gap: 26px 40px;
          font-family:'Courier Prime', monospace;
          font-size: 12px;
        }
        .iws-container .hero .facts dt {
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--olive);
          margin-bottom: 4px;
        }
        .iws-container .hero .facts dd {
          margin:0;
          font-size: 13.5px;
          color: var(--ink);
        }

        /* ---------- Section headers (Annexure style) ---------- */
        .iws-container .annexure-head {
          display:flex;
          align-items: baseline;
          gap: 14px;
          margin: 78px 0 6px;
          padding-bottom: 10px;
          border-bottom: 1.5px solid var(--navy);
        }
        .iws-container .annexure-head .tag {
          font-family:'Courier Prime', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: var(--navy);
          background: var(--paper-card);
          border: 1px solid var(--navy);
          padding: 3px 8px;
          white-space: nowrap;
        }
        .iws-container .annexure-head h2 {
          font-family:'Fraunces', serif;
          font-weight: 500;
          font-size: 22px;
          margin: 0;
          color: var(--ink);
        }
        .iws-container .section-note {
          font-family:'Courier Prime', monospace;
          font-size: 12px;
          color: var(--ink-soft);
          margin: 10px 0 30px;
        }

        /* ---------- Founder / ID card section ---------- */
        .iws-container .founder {
          display:grid;
          grid-template-columns: 260px 1fr;
          gap: 40px;
          align-items: start;
        }

        .iws-container .idcard {
          background: linear-gradient(180deg, var(--paper-card), var(--paper-deep));
          border: 1px solid var(--navy);
          box-shadow: 5px 5px 0 rgba(30,42,66,0.12);
          padding: 0;
          position: relative;
          opacity: 0;
          transform: translateY(14px) rotate(-1.2deg);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .iws-container .idcard.in { opacity:1; transform: translateY(0) rotate(-1.2deg); }

        .iws-container .idcard .strip {
          background: var(--navy);
          color: var(--paper);
          font-family:'Courier Prime', monospace;
          font-size: 10.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 8px 14px;
          display:flex;
          justify-content: space-between;
        }
        .iws-container .idcard .body { padding: 18px; }
        .iws-container .idcard .photo {
          width: 72px; height: 84px;
          border: 1px solid var(--olive);
          background: var(--paper);
          display:flex; align-items:center; justify-content:center;
          font-family:'Fraunces', serif;
          font-size: 26px;
          font-weight: 600;
          color: var(--navy);
          margin-bottom: 14px;
        }
        .iws-container .idcard .field { margin-bottom: 10px; }
        .iws-container .idcard .field label {
          display:block;
          font-family:'Courier Prime', monospace;
          font-size: 9.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--olive);
        }
        .iws-container .idcard .field .val {
          font-family:'Fraunces', serif;
          font-size: 15px;
          line-height: 1.35;
          color: var(--ink);
        }
        .iws-container .idcard .field .val.small {
          font-family:'Lora', serif;
          font-size: 12.5px;
          color: var(--ink-soft);
        }
        .iws-container .idcard .barcode {
          margin-top: 14px;
          height: 22px;
          background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 5px, var(--ink) 5px 6px, transparent 6px 10px);
          opacity: 0.75;
        }
        .iws-container .idcard .verify {
          border-top: 1px dashed var(--olive);
          margin-top: 14px;
          padding-top: 10px;
          font-family:'Courier Prime', monospace;
          font-size: 11px;
        }
        .iws-container .idcard .verify a { color: var(--navy); text-decoration: none; }
        .iws-container .idcard .verify a:hover { text-decoration: underline; }

        .iws-container .founder-copy p {
          line-height: 1.75;
          font-size: 15.5px;
          color: var(--ink);
          margin: 0 0 16px;
        }
        .iws-container .founder-copy p:first-child::first-letter {
          font-family:'Fraunces', serif;
          font-weight: 600;
          font-size: 42px;
          float:left;
          line-height: 0.8;
          padding: 6px 8px 0 0;
          color: var(--stamp);
        }

        /* ---------- Seal / signature element ---------- */
        .iws-container .seal-block {
          display:flex;
          justify-content:center;
          margin: 46px 0 6px;
        }
        .iws-container .seal {
          width: 168px; height: 168px;
          opacity: 0;
          transform: scale(0.6) rotate(-18deg);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(.2,1.4,.4,1);
          mix-blend-mode: multiply;
        }
        .iws-container .seal.in { opacity: 0.92; transform: scale(1) rotate(-9deg); }

        /* ---------- Case files ---------- */
        .iws-container .cases { display:flex; flex-direction:column; gap: 26px; }
        .iws-container .case {
          position: relative;
          border: 1px solid var(--navy);
          background: var(--paper-card);
          padding: 24px 26px;
          overflow: hidden;
        }
        .iws-container .case::before {
          content:"";
          position:absolute; left:0; top:0; bottom:0; width:6px;
          background: var(--olive);
        }
        .iws-container .case .top {
          display:flex;
          justify-content: space-between;
          align-items:flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .iws-container .case .idline {
          font-family:'Courier Prime', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--olive);
          margin-bottom: 6px;
        }
        .iws-container .case h3 {
          font-family:'Fraunces', serif;
          font-weight: 600;
          font-size: 21px;
          margin: 0 0 10px;
          max-width: 34ch;
          color: var(--ink);
        }
        .iws-container .case p {
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink-soft);
          margin: 0 0 14px;
          max-width: 58ch;
        }
        .iws-container .case .meta {
          display:flex;
          gap: 22px;
          flex-wrap:wrap;
          font-family:'Courier Prime', monospace;
          font-size: 11.5px;
          color: var(--ink-soft);
        }
        .iws-container .case .meta strong {
          display:block;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--olive);
          margin-bottom: 2px;
          font-weight: 400;
        }
        .iws-container .case-link {
          display: inline-block;
          margin-top: 16px;
          font-family:'Courier Prime', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--navy);
          border-bottom: 1.5px solid var(--navy);
          padding-bottom: 2px;
          text-decoration: none;
        }
        .iws-container .case-link:hover { color: var(--stamp); border-color: var(--stamp); }

        .iws-container .live-stamp {
          font-family:'Courier Prime', monospace;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--stamp);
          border: 2px solid var(--stamp);
          padding: 5px 10px;
          transform: rotate(-6deg);
          white-space: nowrap;
          flex: 0 0 auto;
        }

        /* ---------- Footer ---------- */
        .iws-container footer {
          margin-top: 90px;
          border-top: 3px double var(--navy);
          padding: 24px 0 50px;
          display:flex;
          justify-content: space-between;
          align-items:flex-end;
          gap: 20px;
          flex-wrap: wrap;
        }
        .iws-container footer .fine {
          font-family:'Courier Prime', monospace;
          font-size: 11.5px;
          color: var(--ink-soft);
          line-height: 1.7;
          max-width: 46ch;
        }
        .iws-container footer a { color: var(--navy); text-decoration: none; }
        .iws-container footer a:hover { text-decoration: underline; }
        .iws-container footer .fine strong { color: var(--ink); }

        @media (max-width: 700px){
          .iws-container .founder { grid-template-columns: 1fr; }
          .iws-container .idcard { max-width: 300px; }
          .iws-container .annexure-head { flex-wrap: wrap; }
        }
      ` }} />

      <div className="iws-wrap">
        <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px dashed var(--line)", marginBottom: "20px", fontFamily: "'Courier Prime', monospace", fontSize: "13px" }}>
          <button 
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "/";
              }
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--navy)", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            ← RETURN TO SEARCH / मुख्य पृष्ठ
          </button>
          <Link href="/" style={{ color: "var(--stamp)", fontWeight: "bold", textDecoration: "underline" }}>
            SEARCH HOME
          </Link>
        </div>

        <header className="letterhead">
          <div className="row">
            <div className="brandmark">
              <div className="crest">IWS</div>
              <div className="name">
                Imposter World Services
                <small>DEPT. OF SOFTWARE &amp; RELATED MATTERS</small>
              </div>
            </div>
            <div className="filecode">
              FILE NO. IWS/2026/001<br />
              JAIPUR, RAJASTHAN
            </div>
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">Notification</div>
          <h1>
            This is to certify that no such department exists — <em>only one person, building things that do.</em>
          </h1>
          <p className="lede">
            Imposter World Services is the name Shubham Agrawal ships work under. There&apos;s no office, no headcount, and no committee — just one engineer, two products currently in production, and a habit of finishing what he starts.
          </p>

          <dl className="facts">
            <div>
              <dt>Founded by</dt>
              <dd>Shubham Agrawal</dd>
            </div>
            <div>
              <dt>Staff strength</dt>
              <dd>1 (one)</dd>
            </div>
            <div>
              <dt>Products live</dt>
              <dd>2 (two)</dd>
            </div>
          </dl>
        </section>

        <div className="annexure-head">
          <span className="tag">Annexure A</span>
          <h2>Particulars of the Proprietor</h2>
        </div>
        <p className="section-note">
          Filed in accordance with the sole founder&apos;s habit of building instead of waiting.
        </p>

        <section className="founder">
          <div className="idcard" id="idcard">
            <div className="strip">
              <span>IWS · ID CARD</span>
              <span>0001</span>
            </div>
            <div className="body">
              <div className="photo relative overflow-hidden group">
                <Image 
                  src="/profile.jpg" 
                  alt="Shubham Agrawal" 
                  fill 
                  className="object-cover transition-all duration-500"
                />
              </div>
              <div className="field">
                <label>Name</label>
                <div className="val">Shubham Agrawal</div>
              </div>
              <div className="field">
                <label>Designation</label>
                <div className="val small">Founder, Sole Proprietor &amp; Only Employee</div>
              </div>
              <div className="field">
                <label>Education</label>
                <div className="val small">
                  Jaipur Engineering College and Research Centre (JECRC), Jaipur, Rajasthan
                </div>
              </div>
              <div className="barcode"></div>
              <div className="verify">
                Verifying authority:<br />
                <a
                  href="https://www.linkedin.com/in/shubham-agrawal-856601244"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  linkedin.com/in/shubham-agrawal-856601244 ↗
                </a>
              </div>
            </div>
          </div>

          <div className="founder-copy">
            <p>
              IWS isn&apos;t a registered company in any legal sense that matters here — it&apos;s the letterhead Shubham puts on his own work so it reads like an organisation instead of a side project. Everything filed under this name is designed, built, deployed, and kept running by him directly, with no team standing between the idea and the shipped product.
            </p>
            <p>
              He studied at Jaipur Engineering College and Research Centre (JECRC) in Jaipur, and has kept building past graduation — trading coursework for two products that real people currently use. The &quot;imposter&quot; in the name is the joke and the point: the work gets judged on whether it runs, not on whether the org chart looks convincing.
            </p>
          </div>
        </section>

        <div className="seal-block">
          <svg className="seal" id="seal" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="rough">
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.04" numOctaves="2" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
              </filter>
              <path id="ringtop" d="M 30,100 A 70,70 0 0 1 170,100" />
              <path id="ringbot" d="M 170,100 A 70,70 0 0 1 30,100" />
            </defs>
            <g filter="url(#rough)" fill="none" stroke="#A2382B" strokeWidth="2.5">
              <circle cx="100" cy="100" r="92" />
              <circle cx="100" cy="100" r="80" />
            </g>
            <g filter="url(#rough)" fill="#A2382B" fontFamily="Courier Prime, monospace" fontSize="12.5" letterSpacing="2.5">
              <text>
                <textPath href="#ringtop" startOffset="50%" textAnchor="middle">
                  IMPOSTER WORLD SERVICES
                </textPath>
              </text>
              <text>
                <textPath href="#ringbot" startOffset="50%" textAnchor="middle">
                  CERTIFIED · GENUINE ARTICLE
                </textPath>
              </text>
            </g>
            <g filter="url(#rough)" fill="#A2382B" textAnchor="middle" fontFamily="Fraunces, serif">
              <text x="100" y="95" fontSize="17" fontWeight="600">NOT AN</text>
              <text x="100" y="118" fontSize="17" fontWeight="600">IMPOSTER</text>
            </g>
            <g filter="url(#rough)" stroke="#A2382B" strokeWidth="1.5">
              <line x1="60" y1="130" x2="140" y2="130" />
            </g>
          </svg>
        </div>

        <div className="annexure-head">
          <span className="tag">Annexure B</span>
          <h2>Active Case Files — 2 Live</h2>
        </div>
        <p className="section-note">Both filed as production systems, not prototypes. Both currently in service.</p>

        <section className="cases">
          <article className="case">
            <div className="top">
              <div>
                <div className="idline">CASE FILE / 001 / PUBLIC DATA TOOL</div>
                <h3>
                  Electoral Roll Explorer<br />Advanced Voter Search
                </h3>
              </div>
              <span className="live-stamp">LIVE</span>
            </div>
            <p>
              A search tool built to make electoral roll data easier to navigate — letting people look up and browse voter records directly, instead of fighting a slow, form-heavy government portal to find the same information.
            </p>
            <div className="meta">
              <div>
                <strong>Category</strong>Civic / public records
              </div>
              <div>
                <strong>Built &amp; run by</strong>Shubham Agrawal
              </div>
              <div>
                <strong>Status</strong>In production
              </div>
            </div>
            <a className="case-link" href="https://34-61-251-113.nip.io/" target="_blank" rel="noopener noreferrer">
              View live deployment ↗
            </a>
          </article>

          <article className="case">
            <div className="top">
              <div>
                <div className="idline">CASE FILE / 002 / EDTECH PLATFORM</div>
                <h3>
                  LearnStudio 2.0<br />Production Learning Platform
                </h3>
              </div>
              <span className="live-stamp">LIVE</span>
            </div>
            <p>
              A ground-up rebuild of an existing learning platform, taken from working prototype to a production system — course delivery, content structure, and the everyday plumbing that keeps an ed-tech product reliable for the people using it.
            </p>
            <div className="meta">
              <div>
                <strong>Category</strong>Education technology
              </div>
              <div>
                <strong>Built &amp; run by</strong>Shubham Agrawal
              </div>
              <div>
                <strong>Status</strong>In production
              </div>
            </div>
            <a className="case-link" href="https://learn-studio-2-0.vercel.app/" target="_blank" rel="noopener noreferrer">
              View live deployment ↗
            </a>
          </article>
        </section>

        <footer>
          <div style={{ marginBottom: "16px" }}>
            <button 
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/";
                }
              }}
              style={{ background: "var(--navy)", color: "var(--paper)", border: "none", padding: "8px 18px", cursor: "pointer", fontFamily: "'Courier Prime', monospace", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}
            >
              ← Return to Main Screen
            </button>
          </div>
          <div className="fine">
            <strong>Imposter World Services</strong> — filed by Shubham Agrawal.<br />
            No board, no shareholders, no objections raised.
          </div>
          <div className="fine">
            Verifying authority:{" "}
            <a href="https://www.linkedin.com/in/shubham-agrawal-856601244" target="_blank" rel="noopener noreferrer">
              LinkedIn ↗
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
