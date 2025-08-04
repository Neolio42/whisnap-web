import config from "@/config";
import ButtonCheckout from "./ButtonCheckout";

const PricingWhisnap = () => {
  return (
    <section className="py-24 bg-whisnap-bg-light dark:bg-whisnap-bg-dark transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-system font-bold text-4xl lg:text-5xl text-whisnap-text-light dark:text-whisnap-text-dark mb-6">
            Want cloud AI?
            <span className="text-whisnap-accent"> Support the project 💙</span>
          </h2>
          <p className="text-xl text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system max-w-3xl mx-auto">
            <strong>The app is free forever.</strong> But if you want cloud AI models (OpenAI, Anthropic, etc.), 
            here are ways to support development while getting extra features.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {config.stripe.plans.map((plan, index) => (
            <div
              key={plan.priceId}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                plan.isFeatured
                  ? 'border-whisnap-accent shadow-whisnap-accent/20'
                  : 'border-whisnap-surface-orange/30 hover:border-whisnap-accent/50'
              }`}
            >
              {plan.isFeatured && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-whisnap-accent text-white px-6 py-2 rounded-full text-sm font-system font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="font-system font-bold text-2xl text-whisnap-text-light dark:text-whisnap-text-dark mb-2">
                  {plan.name}
                </h3>
                <p className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70 font-system mb-6">
                  {plan.description}
                </p>
                
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-5xl font-system font-bold text-whisnap-text-light dark:text-whisnap-text-dark">
                    ${plan.price}
                  </span>
                  <div className="text-left">
                    <div className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60 text-sm font-system">
                      {plan.isMonthly ? '/month' : 'one-time'}
                    </div>
                  </div>
                </div>

                {plan.priceAnchor && (
                  <div className="text-whisnap-text-light/50 dark:text-whisnap-text-dark/50 text-lg line-through mb-2">
                    ${plan.priceAnchor}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                      index === 0 ? 'bg-whisnap-surface-blue' : 'bg-whisnap-surface-green'
                    }`}>
                      <svg className="w-3 h-3 text-whisnap-accent" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-whisnap-text-light dark:text-whisnap-text-dark font-system">
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <ButtonCheckout
                priceId={plan.priceId}
                className={`w-full py-4 px-6 rounded-xl font-system font-semibold text-lg transition-all duration-200 ${
                  plan.isFeatured
                    ? 'bg-whisnap-accent hover:bg-whisnap-accent/90 text-white shadow-lg hover:shadow-xl'
                    : 'bg-whisnap-surface-orange hover:bg-whisnap-surface-orange-hover text-whisnap-text-light border-2 border-whisnap-surface-orange-hover'
                }`}
              >
                {plan.isMonthly ? 'Support & Get Cloud AI' : 'Support & Get BYOK'}
              </ButtonCheckout>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <div className="text-center mt-16">
          <div className="bg-whisnap-surface-blue/20 dark:bg-whisnap-surface-blue/10 rounded-xl p-8 mb-12">
            <h3 className="font-system font-bold text-2xl text-whisnap-text-light dark:text-whisnap-text-dark mb-4">
              🎉 Remember: The core app is FREE
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm font-system max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="text-2xl mb-2">🆓</div>
                <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-1">
                  Always Free
                </div>
                <div className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70">
                  All local models, unlimited transcriptions, history, files
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="text-2xl mb-2">🔒</div>
                <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-1">
                  Complete Privacy
                </div>
                <div className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70">
                  Everything processes locally on your Mac
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold text-whisnap-text-light dark:text-whisnap-text-dark mb-1">
                  Native macOS
                </div>
                <div className="text-whisnap-text-light/70 dark:text-whisnap-text-dark/70">
                  Real-time streaming, hotkeys, menu bar integration
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-whisnap-surface-orange/30 rounded-lg">
              <p className="text-sm text-whisnap-text-light/80 dark:text-whisnap-text-dark/80 font-system">
                💡 <strong>Optional upgrades only add cloud AI models.</strong> 
                Everything else (transcription, history, privacy) stays free forever.
              </p>
            </div>
          </div>

          <p className="text-whisnap-text-light/60 dark:text-whisnap-text-dark/60 font-system">
            Questions? Email us at{" "}
            <a href="mailto:support@whisnap.com" className="text-whisnap-accent hover:underline">
              support@whisnap.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingWhisnap;