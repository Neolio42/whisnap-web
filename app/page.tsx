import Link from "next/link";
import NavHeader from "@/components/NavHeader";
import HeroWhisnap from "@/components/HeroWhisnap";
import PricingWhisnap from "@/components/PricingWhisnap";

export default function Page() {
  return (
    <>
      <NavHeader variant="homepage" />

      <main>
        {/* Hero Section */}
        <HeroWhisnap />
        
        {/* Features Section */}
        <section id="features" className="py-24 bg-whisnap-bg-light dark:bg-whisnap-bg-dark transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-16">
              <div className="inline-block bg-whisnap-accent text-white px-6 py-3 rounded-full font-system font-bold text-lg mb-6">
                🎉 100% FREE FOREVER
              </div>
              <h2 className="font-system font-bold text-4xl lg:text-5xl text-whisnap-text-light dark:text-whisnap-text-dark mb-6">
                Everything included
                <span className="text-whisnap-accent"> at no cost</span>
              </h2>
              <p className="text-xl text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system max-w-3xl mx-auto">
                <strong>Zero cost. Zero limits.</strong> Download once and use forever with all features unlocked.
                No hidden fees, no premium tiers, no subscriptions.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: '🔄',
                  title: 'Real-time Streaming',
                  description: 'Get transcriptions as you speak with ultra-low latency WebSocket streaming',
                  badge: 'FREE'
                },
                {
                  icon: '🔒',
                  title: 'Local Privacy',
                  description: 'All processing happens on your Mac with Whisper and Nvidia Parakeet models',
                  badge: 'FREE'
                },
                {
                  icon: '🤖',
                  title: 'Multiple AI Models',
                  description: 'Local Whisper models plus optional cloud AI from OpenAI, Anthropic, and more',
                  badge: 'FREE + Optional'
                },
                {
                  icon: '∞',
                  title: 'Unlimited Usage',
                  description: 'No limits on transcriptions, file uploads, or reprocessing. Use as much as you want',
                  badge: 'FREE'
                },
                {
                  icon: '📁',
                  title: 'Smart Organization',
                  description: 'Upload audio files, save transcription history, export in multiple formats',
                  badge: 'FREE'
                },
                {
                  icon: '⚡',
                  title: 'Native macOS',
                  description: 'Beautiful desktop app with system-wide hotkeys and seamless integration',
                  badge: 'FREE'
                }
              ].map((feature, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 border-whisnap-surface-orange/30 hover:border-whisnap-accent hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">{feature.icon}</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-system font-bold ${
                      feature.badge === 'FREE' 
                        ? 'bg-whisnap-accent text-white' 
                        : 'bg-whisnap-surface-blue text-whisnap-text-light'
                    }`}>
                      {feature.badge}
                    </span>
                  </div>
                  <h3 className="font-system font-bold text-xl text-whisnap-text-light dark:text-whisnap-text-dark mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Feature highlights */}
            <div className="mt-16 bg-whisnap-surface-green/20 rounded-xl p-8 text-center">
              <h3 className="font-system font-bold text-2xl text-whisnap-text-light dark:text-whisnap-text-dark mb-4">
                🎉 What makes Whisnap special
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-sm font-system">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">🆓</div>
                  <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-2">Always Free</div>
                  <div className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60">Core features never require payment</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">🔒</div>
                  <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-2">Privacy First</div>
                  <div className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60">Local processing keeps your data safe</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-2">Professional Quality</div>
                  <div className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60">Enterprise-grade features for everyone</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <div id="pricing">
          <PricingWhisnap />
        </div>

        {/* CTA Section */}
        <section className="py-24 bg-whisnap-accent">
          <div className="max-w-4xl mx-auto text-center px-8">
            <h2 className="font-system font-bold text-4xl lg:text-5xl text-white mb-6">
              Download the FREE app now!
            </h2>
            <p className="text-xl text-white/90 font-system mb-8 max-w-2xl mx-auto">
              <strong>No signup required.</strong> No credit card. No trials. 
              Just download and start transcribing with professional AI models.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white hover:bg-gray-100 text-whisnap-accent font-system font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                Download FREE for macOS
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-whisnap-accent font-system font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-200">
                Explore Features
              </button>
            </div>
            
            <div className="mt-8 bg-white/20 rounded-lg p-4">
              <p className="text-white/90 font-system text-sm">
                ✨ <strong>Professional transcription made accessible</strong> — Real-time streaming, 
                local privacy, and unlimited usage for everyone.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-whisnap-bg-light dark:bg-whisnap-bg-dark border-t border-whisnap-surface-orange/20 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-whisnap-accent rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-system font-bold text-xl text-whisnap-text-light dark:text-whisnap-text-dark">
                  Whisnap
                </span>
              </div>
              <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system text-sm">
                Real-time AI transcription for macOS with privacy and precision.
              </p>
            </div>
            
            <div>
              <h4 className="font-system font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-4">Product</h4>
              <div className="space-y-2">
                <Link href="#features" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Features
                </Link>
                <Link href="#pricing" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Pricing
                </Link>
                <Link href="/dashboard" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Dashboard
                </Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-system font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-4">Support</h4>
              <div className="space-y-2">
                <Link href="/blog" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Blog
                </Link>
                <a href="mailto:support@whisnap.com" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Support
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-system font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-4">Legal</h4>
              <div className="space-y-2">
                <Link href="/privacy-policy" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/tos" className="block text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 hover:text-whisnap-accent font-system text-sm transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
          
          <div className="border-t border-whisnap-surface-orange/20 mt-12 pt-8 text-center">
            <p className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60 font-system text-sm">
              © 2024 Whisnap. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
