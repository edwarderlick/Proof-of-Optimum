import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function WhatGetsCounted() {
  return (
    <div className="bg-neutral-50 border border-neutral-200/80 rounded-[20px] p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 overflow-hidden relative select-none">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-black text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
        <BarChart3 className="w-10 h-10" />
      </div>
      
      <div className="flex-grow text-center md:text-left z-10">
        <h4 className="font-sans text-xl md:text-2xl font-bold text-black mb-2">What gets counted</h4>
        <p className="font-sans text-base text-neutral-500 max-w-2xl leading-relaxed">
          Original posts, quote tweets, and replies with commentary that mention <span className="text-black font-extrabold">@get_optimum</span> or the keyword <span className="text-black font-extrabold">get_optimum</span>. Plain retweets and empty replies are excluded.
        </p>
      </div>

      <div className="hidden lg:block absolute -right-12 -bottom-12 w-48 h-48 bg-black/[0.02] rounded-full blur-3xl"></div>
    </div>
  );
}
