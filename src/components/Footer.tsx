import React from 'react';

interface FooterProps {
  onNavClick: (view: 'leaderboard' | 'analytics' | 'about') => void;
}

export default function Footer({ onNavClick }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 py-16 w-full select-none">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-2 font-sans font-bold text-black text-sm select-none">
            <img src="/optimum.png" alt="Optimum" className="w-4 h-4 object-contain" />
            <span>Proof of Optimum</span>
          </div>
          <p className="text-neutral-400 font-sans text-xs text-center md:text-left max-w-sm leading-relaxed">
            Proof of Optimum is an independent community project. It is not affiliated with Optimum or X, does not handle funds, and is not financial advice. Live stats are sampled from public X data via twitterapi.io and refreshed every 6 hours.
          </p>
          <p className="text-neutral-400 font-sans text-xs text-center md:text-left">
            © 2026 Proof of Optimum. Independent community project.
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap justify-center gap-8">
          <button 
            onClick={() => onNavClick('analytics')}
            className="font-sans text-xs text-neutral-500 hover:text-black transition-colors"
          >
            Analytics
          </button>
          <button 
            onClick={() => onNavClick('leaderboard')}
            className="font-sans text-xs text-neutral-500 hover:text-black transition-colors underline decoration-neutral-200 underline-offset-4"
          >
            Leaderboard
          </button>
          <button 
            onClick={() => onNavClick('about')}
            className="font-sans text-xs text-neutral-500 hover:text-black transition-colors"
          >
            About
          </button>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert('Proof of Optimum values user data integrity. No personal data is stored or logged.'); }}
            className="font-sans text-xs text-neutral-500 hover:text-black transition-colors"
          >
            Privacy
          </a>
          <a
            href="https://x.com/SamirAhame96036"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs text-neutral-500 hover:text-black transition-colors"
          >
            Developed by <span className="font-semibold">@SamirAhame96036</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
