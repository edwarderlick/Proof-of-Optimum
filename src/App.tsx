import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import BlobBackground from './components/BlobBackground';
import StatsGrid from './components/StatsGrid';
import WhatGetsCounted from './components/WhatGetsCounted';
import Leaderboard from './components/Leaderboard';
import UserProfileModal from './components/UserProfileModal';
import Footer from './components/Footer';

import { useGlobalStats } from './hooks/useGlobalStats';
import { useScanUser } from './hooks/useScanUser';
import { IndexedUser, RankMode } from './types';
import { isFirebaseConfigured } from './config/firebase';

export default function App() {
  const [activeView, setActiveView] = useState<'leaderboard' | 'analytics' | 'about'>('leaderboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [rankMode, setRankMode] = useState<RankMode>('views');
  
  // Modal State for profile details
  const [selectedUser, setSelectedUser] = useState<IndexedUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Stats Hooks
  const { stats, loading: statsLoading, countdown } = useGlobalStats();

  // Scan User Hook
  const { scan, result: scanResult, status: scanStatus, error: scanError, setResult: setScanResult, setStatus: setScanStatus } = useScanUser();

  // Trigger scan handle
  const handleScan = async (handle: string) => {
    await scan(handle);
  };

  // Watch scan result to open modal on success
  React.useEffect(() => {
    if (scanStatus === 'success' && scanResult) {
      setSelectedUser(scanResult);
      setIsModalOpen(true);
      // reset scan states
      setScanResult(null);
      setScanStatus('idle');
    }
  }, [scanStatus, scanResult]);

  const handleRowSelect = (user: IndexedUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleNavClick = (view: 'leaderboard' | 'analytics' | 'about') => {
    setActiveView(view);
    const element = document.getElementById(view);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f5f5f5] text-black overflow-x-hidden font-sans">
      {/* Floating Metallic Blobs */}
      <BlobBackground />

      {/* Floating Header Navbar */}
      <Navbar onNavClick={handleNavClick} activeView={activeView} />

      {/* Main Content Sections */}
      <main className="relative z-10">
        
        {/* Banner if running in Fallback mode */}
        {!isFirebaseConfigured && (
          <div className="fixed bottom-4 left-4 z-[100] bg-white border border-neutral-200 shadow-lg px-4 py-2.5 rounded-2xl flex items-center gap-2 select-none font-sans text-[11px] uppercase tracking-wider font-extrabold text-neutral-500 animate-bounce">
            <span className="w-2.5 h-2.5 bg-[#C9A84C] rounded-full"></span>
            <span>Running in local fallback mode. Add Firebase keys in settings!</span>
          </div>
        )}

        {/* Hero & Scan Section */}
        <div id="about">
          <HeroSection 
            onSearch={handleScan} 
            isLoading={scanStatus === 'scanning'} 
            searchError={scanError}
            countdown={countdown}
          />
        </div>

        {/* Global Statistics Section */}
        <section id="analytics" className="bg-white py-20 px-6 border-t border-neutral-200 select-none">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-12 text-center md:text-left">
              <h2 className="font-mono text-[11px] text-neutral-400 uppercase tracking-[0.3em] mb-3">Global Stats</h2>
              <h3 className="font-sans text-2xl md:text-3xl font-extrabold text-black tracking-tight">The Network Growth</h3>
            </div>
            
            <StatsGrid stats={stats} loading={statsLoading} />
            <WhatGetsCounted />
          </div>
        </section>

        {/* Leaderboard Section */}
        <section id="leaderboard" className="py-20 bg-[#fbfbfb] border-t border-neutral-100 select-none">
          <div className="max-w-[1200px] mx-auto px-6 mb-10">
            <div className="text-center md:text-left mb-6">
              <h1 className="font-sans text-3xl md:text-5xl font-black text-black tracking-tight mb-2">Leaderboard</h1>
              <p className="text-neutral-500 font-sans text-base leading-relaxed">
                Ranked by Optimum-related views on X, all time.
              </p>
            </div>
          </div>

          <Leaderboard
            onUserSelect={handleRowSelect}
            onScan={handleScan}
            isScanning={scanStatus === 'scanning'}
            scanError={scanError}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            rankMode={rankMode}
            setRankMode={setRankMode}
          />
        </section>


      </main>

      {/* Profile Details Modal */}
      <UserProfileModal 
        user={selectedUser} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Footer */}
      <Footer onNavClick={handleNavClick} />
    </div>
  );
}
