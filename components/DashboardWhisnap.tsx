import { User } from "next-auth";
import NavHeader from "./NavHeader";
import ButtonAccount from "./ButtonAccount";

interface DashboardWhisnapProps {
  user?: User;
}

const DashboardWhisnap = ({ user }: DashboardWhisnapProps) => {
  return (
    <div className="min-h-screen bg-whisnap-bg-light dark:bg-whisnap-bg-dark transition-colors duration-300">
      <NavHeader variant="app" />
      
      <div className="max-w-4xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-system font-bold text-4xl text-whisnap-text-light dark:text-whisnap-text-dark mb-4">
            Welcome to Whisnap{user?.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-xl text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system">
            Your free AI transcription app is ready to use
          </p>
        </div>

        {/* Quick Start */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Download App */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-whisnap-surface-blue/30 p-8 text-center">
            <div className="w-16 h-16 bg-whisnap-surface-blue rounded-xl mx-auto mb-6 flex items-center justify-center">
              <svg className="w-8 h-8 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-system font-bold text-xl text-whisnap-text-light dark:text-whisnap-text-dark mb-3">
              Download macOS App
            </h3>
            <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system mb-6">
              Get the native app with local Whisper models and real-time transcription
            </p>
            <button className="bg-whisnap-accent hover:bg-whisnap-accent/90 text-white font-system font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg hover:shadow-xl">
              Download Free App
            </button>
          </div>

          {/* Current Plan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-whisnap-surface-green/30 p-8 text-center">
            <div className="w-16 h-16 bg-whisnap-surface-green rounded-xl mx-auto mb-6 flex items-center justify-center">
              <svg className="w-8 h-8 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-system font-bold text-xl text-whisnap-text-light dark:text-whisnap-text-dark mb-3">
              Free Plan
            </h3>
            <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system mb-6">
              Unlimited local transcription with Whisper and Nvidia Parakeet models
            </p>
            <div className="text-sm text-whisnap-accent font-system font-medium">
              ✨ Always Free • No Limits
            </div>
          </div>
        </div>

        {/* What You Get For Free */}
        <div className="bg-whisnap-surface-blue/20 dark:bg-whisnap-surface-blue/10 rounded-xl p-8 mb-12">
          <h2 className="font-system font-bold text-2xl text-whisnap-text-light dark:text-whisnap-text-dark mb-6 text-center">
            🎉 What you get for FREE (forever)
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  All local AI models (Whisper, Nvidia Parakeet)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  Unlimited transcriptions & reprocessing
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  File uploads & transcription history
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  Real-time streaming transcription
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  Complete privacy (everything local)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-whisnap-accent rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system text-whisnap-text-light dark:text-whisnap-text-dark">
                  Native macOS app with hotkeys
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-whisnap-surface-orange/30 rounded-lg">
            <p className="text-sm text-whisnap-text-light/80 dark:text-whisnap-text-dark/80 font-system text-center">
              💡 <strong>Seriously, it's actually free.</strong> No trials, no limits, no catch. 
              Professional-grade transcription accessible to everyone.
            </p>
          </div>
        </div>

        {/* Optional Upgrades */}
        <div className="text-center">
          <h2 className="font-system font-bold text-2xl text-whisnap-text-light dark:text-whisnap-text-dark mb-4">
            Optional: Support the project 💙
          </h2>
          <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system mb-8">
            Want cloud AI models? Here are ways to support development while getting extra features
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-whisnap-surface-orange/30 flex-1">
              <h3 className="font-system font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-2">
                BYOK Plan - $10 once
              </h3>
              <p className="text-sm text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system">
                Bring your own API keys for cloud models
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-whisnap-surface-green/30 flex-1">
              <h3 className="font-system font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-2">
                Cloud Plan - $15/month
              </h3>
              <p className="text-sm text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system">
                I handle the API costs for you
              </p>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="mt-16 pt-8 border-t border-whisnap-surface-orange/20 text-center">
          <ButtonAccount />
        </div>
      </div>
    </div>
  );
};

export default DashboardWhisnap;