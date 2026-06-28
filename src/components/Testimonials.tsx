import React from 'react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Proof of Optimum completely redefines how we measure developer advocacy and core community building on social channels.",
    name: "Alex Rivers",
    role: "Core Contributor",
    company: "L2 Accelerator"
  },
  {
    quote: "The ranking is 100% transparent and encourages high-signal technical research rather than empty social spam.",
    name: "Elena Rostova",
    role: "Lead Researcher",
    company: "Optimum Labs"
  },
  {
    quote: "Indexing social acceleration metrics in real-time allows our ecosystem partners to reward high-value contributors on the fly.",
    name: "Nikhil Nair",
    role: "Ecosystem VP",
    company: "Ethereum Foundation"
  }
];

export default function Testimonials() {
  return (
    <section className="py-20 bg-white border-t border-neutral-100 select-none">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="mb-12 text-center md:text-left">
          <h2 className="font-mono text-[11px] text-neutral-400 uppercase tracking-[0.3em] mb-3">Community</h2>
          <h3 className="font-sans text-2xl md:text-3xl font-extrabold text-black tracking-tight">Ecosystem Voices</h3>
        </div>

        {/* Testimonials Grid / Carousel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <div 
              key={idx}
              className="bg-[#f5f5f5] rounded-[24px] p-8 relative flex flex-col justify-between min-h-[220px] shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:scale-[1.01] transition-all"
            >
              {/* Large quote mark */}
              <span className="absolute top-4 right-6 font-sans text-7xl font-bold text-neutral-200/80 leading-none">
                “
              </span>

              {/* Quote text */}
              <p className="text-[#333333] font-sans text-sm md:text-[15px] leading-relaxed mb-6 italic z-10">
                {t.quote}
              </p>

              {/* Attribution */}
              <div className="flex flex-col gap-2 pt-4 border-t border-neutral-200/50">
                <span className="font-sans text-sm font-bold text-black">{t.name}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-[9px] uppercase tracking-wider bg-white px-2 py-0.5 rounded-full border border-neutral-200 font-extrabold text-neutral-500">
                    {t.role}
                  </span>
                  <span className="font-sans text-[10px] uppercase tracking-widest font-black text-[#C9A84C]">
                    {t.company}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
