import Image from "next/image";
import config from "@/config";

const HeroWhisnap = () => {
  return (
    <section className="min-h-screen bg-whisnap-bg-light dark:bg-whisnap-bg-dark transition-colors duration-300 pt-20">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-20 px-8 py-16 lg:py-24">
        <div className="flex flex-col gap-8 lg:gap-12 items-center justify-center text-center lg:text-left lg:items-start lg:w-1/2">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-whisnap-surface-orange dark:bg-whisnap-surface-orange/20 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-whisnap-accent rounded-full animate-pulse"></div>
            <span className="text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">
              100% FREE forever • No trials, no limits
            </span>
          </div>

          {/* Main heading */}
          <h1 className="font-system font-bold text-5xl lg:text-7xl tracking-tight text-whisnap-text-light dark:text-whisnap-text-dark leading-tight">
            Professional
            <span className="text-whisnap-accent"> AI transcription </span>
            for macOS
          </h1>

          {/* Subheading */}
          <p className="text-xl lg:text-2xl font-system text-whisnap-text-light/80 dark:text-whisnap-text-dark/80 leading-relaxed max-w-2xl">
            <strong>Completely free</strong> real-time transcription with local privacy. 
            Unlimited Whisper models + optional cloud AI for advanced features.
          </p>

          {/* Feature highlights */}
          <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
            <div className="flex items-center gap-2 bg-whisnap-surface-green dark:bg-whisnap-surface-green/20 px-4 py-2 rounded-lg">
              <svg className="w-5 h-5 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">100% FREE</span>
            </div>
            <div className="flex items-center gap-2 bg-whisnap-surface-blue dark:bg-whisnap-surface-blue/20 px-4 py-2 rounded-lg">
              <svg className="w-5 h-5 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">Unlimited transcriptions</span>
            </div>
            <div className="flex items-center gap-2 bg-whisnap-surface-pink dark:bg-whisnap-surface-pink/20 px-4 py-2 rounded-lg">
              <svg className="w-5 h-5 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">Local privacy</span>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <button className="bg-whisnap-accent hover:bg-whisnap-accent/90 text-white font-system font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl">
              Download FREE App
            </button>
            <button className="bg-white dark:bg-gray-800 border-2 border-whisnap-accent text-whisnap-accent hover:bg-whisnap-accent hover:text-white font-system font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-200">
              See What&apos;s Free
            </button>
          </div>

          {/* Features callout */}
          <div className="bg-whisnap-surface-blue/20 p-4 rounded-lg">
            <p className="text-sm font-system text-whisnap-text-light/80 dark:text-whisnap-text-dark/80">
              ✨ <strong>Everything included for free:</strong> Real-time streaming, local models, 
              unlimited transcriptions, file history, and privacy-first design.
            </p>
          </div>
        </div>

        {/* Product showcase */}
        <div className="lg:w-1/2 relative">
          {/* Background decoration */}
          <div className="absolute -inset-4 bg-gradient-to-r from-whisnap-surface-pink via-whisnap-surface-blue to-whisnap-surface-green rounded-3xl opacity-30 blur-lg"></div>
          
          {/* Main product image container */}
          <div className="relative bg-whisnap-bg-light dark:bg-whisnap-bg-dark rounded-2xl shadow-2xl p-8 border border-whisnap-surface-orange/30">
            {/* Mock app interface */}
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-whisnap-surface-orange/20">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="ml-4 text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">
                  Whisnap - Real-time Transcription
                </span>
              </div>

              {/* Transcription display */}
              <div className="bg-whisnap-surface-blue/50 dark:bg-whisnap-surface-blue/10 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-whisnap-accent rounded-full animate-pulse"></div>
                  <span className="text-sm font-system font-medium text-whisnap-text-light dark:text-whisnap-text-dark">
                    Live transcription
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-whisnap-text-light dark:text-whisnap-text-dark font-system">
                    &quot;Welcome to the future of transcription. This is being transcribed in real-time using advanced AI models...&quot;
                  </p>
                  <div className="flex items-center gap-2 text-sm text-whisnap-text-light/60 dark:text-whisnap-text-dark/60">
                    <span>GPT-4o</span>
                    <span>•</span>
                    <span>99.2% accuracy</span>
                    <span>•</span>
                    <span>45ms latency</span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-4">
                  <button className="w-12 h-12 bg-whisnap-accent rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="text-sm font-system text-whisnap-text-light/70 dark:text-whisnap-text-dark/70">
                    <div>Recording: 00:23</div>
                    <div className="text-xs">AssemblyAI Streaming</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1 bg-whisnap-surface-green/50 rounded-full text-xs font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                    Auto-save
                  </div>
                  <div className="px-3 py-1 bg-whisnap-surface-peach/50 rounded-full text-xs font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                    $0.002
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroWhisnap;