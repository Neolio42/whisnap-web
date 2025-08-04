import Link from "next/link";
import ButtonSignin from "./ButtonSignin";

interface NavHeaderProps {
  variant?: 'homepage' | 'app';
}

const NavHeader = ({ variant = 'homepage' }: NavHeaderProps) => {
  return (
    <header className={`${variant === 'homepage' ? 'absolute top-0 left-0 right-0 z-50 bg-whisnap-bg-light/80 dark:bg-whisnap-bg-dark/80 backdrop-blur-sm' : 'bg-whisnap-bg-light dark:bg-whisnap-bg-dark'} border-b border-whisnap-surface-orange/20`}>
      <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-whisnap-accent rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="font-system font-bold text-xl text-whisnap-text-light dark:text-whisnap-text-dark">
            Whisnap
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="font-system text-whisnap-text-light dark:text-whisnap-text-dark hover:text-whisnap-accent transition-colors">
            Features
          </Link>
          <Link href="/#pricing" className="font-system text-whisnap-text-light dark:text-whisnap-text-dark hover:text-whisnap-accent transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard" className="font-system text-whisnap-text-light dark:text-whisnap-text-dark hover:text-whisnap-accent transition-colors">
            Dashboard
          </Link>
          <Link href="/blog" className="font-system text-whisnap-text-light dark:text-whisnap-text-dark hover:text-whisnap-accent transition-colors">
            Blog
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <a 
            href="#download" 
            className="hidden md:block bg-white dark:bg-gray-800 border-2 border-whisnap-accent text-whisnap-accent hover:bg-whisnap-accent hover:text-white font-system font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Download
          </a>
          <ButtonSignin text="Sign In" className="bg-whisnap-accent hover:bg-whisnap-accent/90 text-white font-system font-medium px-6 py-2 rounded-lg transition-colors" />
        </div>
      </div>
    </header>
  );
};

export default NavHeader;