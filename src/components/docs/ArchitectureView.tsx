export const ArchitectureView = () => {
  return (
    <div className="h-full flex flex-col -m-8">
      {/* Sub Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">System Documentation</h1>
          <p className="text-[13px] text-slate-500">Technical Specifications, Database Schema & API Definitions</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Section 1: Architecture */}
          <section className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 tracking-tight">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
              System Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 text-[14px]">Recommended Tech Stack</h3>
                <ul className="space-y-2 text-slate-600 text-[13px]">
                  <li><span className="font-semibold text-slate-800">Frontend:</span> React.js 19, TypeScript, Tailwind CSS, Vite.</li>
                  <li><span className="font-semibold text-slate-800">Backend:</span> Node.js with Express.js (REST API architecture).</li>
                  <li><span className="font-semibold text-slate-800">Database:</span> PostgreSQL with Prisma ORM for relational integrity.</li>
                  <li><span className="font-semibold text-slate-800">Authentication:</span> JWT via Auth0 or Firebase.</li>
                  <li><span className="font-semibold text-slate-800">File Storage:</span> AWS S3 for saving SOC PDFs and Claim documents.</li>
                  <li><span className="font-semibold text-slate-800">PDF Generation:</span> Puppeteer (Server-side) or jsPDF (Client-side).</li>
                </ul>
              </div>
              <div className="bg-[#f8fafc] border border-slate-200 p-4 rounded-md font-mono text-[11px] text-slate-600 overflow-x-auto">
                {`[Client / Browser]
       │
 (REST / JSON)
       ▼
[ Node/Express API ] ──► [ AWS S3 / Documents ]
       │
 (Prisma ORM)
       ▼
 [ PostgreSQL DB ]`}
              </div>
            </div>
          </section>

          {/* Section 2: Database Schema */}
          <section className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 tracking-tight">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">2</span>
              Database Schema (PostgreSQL)
            </h2>
            <div className="space-y-4">
              <div className="bg-[#0f172a] text-slate-300 p-5 rounded-md font-mono text-[12px] overflow-x-auto leading-relaxed">
<pre><code>{`Table Clients {
  id String [pk]
  name String
  email String
  phone String
  company String
  type ClientType // Enum: 'New Business', 'Renewal'
  createdAt DateTime
}

Table Deals {
  id String [pk]
  clientId String [ref: > Clients.id]
  title String
  value Float
  type ClientType
  stage String // Enum based on pipeline type
  lastUpdated DateTime
}

Table Claims {
  id String [pk]
  dealId String [ref: > Deals.id]
  title String
  status String
  documents String[] // Array of S3 URLs
}

Table Endorsements {
  id String [pk]
  dealId String [ref: > Deals.id]
  type String
  status String
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Section 3: API Endpoints */}
          <section className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 tracking-tight">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">3</span>
              API Endpoints Design
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
              <div className="p-4 border border-slate-200 rounded-md bg-[#f8fafc]">
                <h4 className="font-bold text-slate-900 mb-2">Deals / Pipeline</h4>
                <ul className="space-y-2">
                  <li><span className="text-blue-600 font-mono font-bold text-[11px] mr-1">GET</span> /api/deals?type=NewBusiness</li>
                  <li><span className="text-emerald-600 font-mono font-bold text-[11px] mr-1">POST</span> /api/deals</li>
                  <li><span className="text-orange-600 font-mono font-bold text-[11px] mr-1">PUT</span> /api/deals/:id/stage</li>
                  <li className="text-slate-500 text-[11px] mt-1 ml-8">Payload: {'{ stage: "Negotiation" }'}</li>
                </ul>
              </div>
              <div className="p-4 border border-slate-200 rounded-md bg-[#f8fafc]">
                <h4 className="font-bold text-slate-900 mb-2">SOC Generation</h4>
                <ul className="space-y-2">
                  <li><span className="text-emerald-600 font-mono font-bold text-[11px] mr-1">POST</span> /api/deals/:id/generate-soc</li>
                  <li className="text-slate-500 text-[11px] mt-1 ml-9">Returns URL of the generated S3 PDF</li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
