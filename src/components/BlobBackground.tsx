import React from 'react';

export default function BlobBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
      {/* Dynamic atmospheric radial gradient blobs */}
      <div 
        className="absolute w-[300px] h-[300px] rounded-full blur-[40px] opacity-40 animate-float"
        style={{
          top: '15%',
          left: '-5%',
          background: 'radial-gradient(circle, rgba(209,209,209,0.7) 0%, rgba(245,245,245,0) 70%)',
        }}
      />
      
      <div 
        className="absolute w-[400px] h-[400px] rounded-full blur-[50px] opacity-35 animate-float-delayed"
        style={{
          bottom: '20%',
          right: '-10%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, rgba(209,209,209,0.4) 50%, rgba(245,245,245,0) 80%)',
        }}
      />

      <div 
        className="absolute w-[200px] h-[200px] rounded-full blur-[35px] opacity-30 animate-float"
        style={{
          top: '40%',
          right: '25%',
          background: 'radial-gradient(circle, rgba(209,209,209,0.5) 0%, rgba(245,245,245,0) 70%)',
        }}
      />

      <div 
        className="absolute w-[120px] h-[120px] rounded-full blur-[25px] opacity-40 animate-float-delayed"
        style={{
          bottom: '10%',
          left: '20%',
          background: 'radial-gradient(circle, rgba(209,209,209,0.6) 0%, rgba(245,245,245,0) 70%)',
        }}
      />

      {/* Multi-blob cluster on center-right of hero section — hidden on mobile */}
      <div className="hidden md:flex absolute top-[20%] right-[10%] w-[450px] h-[450px] items-center justify-center opacity-60 mix-blend-multiply select-none">
        <div className="relative w-[350px] h-[350px] animate-spin-slow">
          {/* Overlapping Blob 1 (300px) */}
          <div 
            className="absolute rounded-full border border-neutral-300/10 blur-[2px]"
            style={{
              width: '300px',
              height: '300px',
              top: '0',
              left: '0',
              background: 'radial-gradient(circle at 30% 30%, rgba(240,240,240,0.95) 0%, rgba(200,200,200,0.5) 70%, rgba(160,160,160,0.2) 100%)',
              boxShadow: 'inset 0 10px 30px rgba(255,255,255,0.8), 0 20px 40px rgba(0,0,0,0.05)',
            }}
          />
          {/* Overlapping Blob 2 (250px) */}
          <div 
            className="absolute rounded-full border border-neutral-300/10 blur-[1px]"
            style={{
              width: '250px',
              height: '250px',
              bottom: '20px',
              right: '20px',
              background: 'radial-gradient(circle at 40% 40%, rgba(245,245,245,0.9) 0%, rgba(195,195,195,0.45) 60%, rgba(150,150,150,0.15) 100%)',
              boxShadow: 'inset 0 10px 25px rgba(255,255,255,0.8), 0 15px 30px rgba(0,0,0,0.04)',
            }}
          />
          {/* Overlapping Blob 3 (200px) */}
          <div 
            className="absolute rounded-full border border-neutral-300/10 blur-[1px]"
            style={{
              width: '200px',
              height: '200px',
              top: '50px',
              right: '50px',
              background: 'radial-gradient(circle at 30% 30%, rgba(250,250,250,0.95) 0%, rgba(205,205,205,0.5) 65%, rgba(170,170,170,0.2) 100%)',
              boxShadow: 'inset 0 8px 20px rgba(255,255,255,0.8), 0 10px 20px rgba(0,0,0,0.03)',
            }}
          />
          {/* Overlapping Blob 4 (180px) */}
          <div 
            className="absolute rounded-full border border-neutral-300/10 blur-[1px]"
            style={{
              width: '180px',
              height: '180px',
              bottom: '50px',
              left: '50px',
              background: 'radial-gradient(circle at 50% 50%, rgba(235,235,235,0.9) 0%, rgba(190,190,190,0.4) 70%, rgba(140,140,140,0.1) 100%)',
              boxShadow: 'inset 0 6px 15px rgba(255,255,255,0.8), 0 8px 15px rgba(0,0,0,0.02)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
