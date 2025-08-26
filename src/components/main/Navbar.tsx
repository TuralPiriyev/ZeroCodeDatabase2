import { useState, useEffect } from 'react';
import { Database, Menu, X, Settings } from 'lucide-react';
import SettingsModal from './SettingsModal';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white shadow-md py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          <a
            href="#"
            className="flex items-center space-x-2 text-2xl font-bold text-[#007ACC]"
          >
            <Database className="h-8 w-8" />
            <span>Database Creator</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="#home"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              Home
            </a>
            <a
              href="#benefits"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              Benefits
            </a>
            <a
              href="#subscription"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              Subscription
            </a>
            <a
              href="#how-to-use"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              How to Use
            </a>
            <a
              href="#contact"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              Contact
            </a>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium"
            >
              <Settings size={18} />
              Settings
            </button>
            <a
              href="#"
              className="bg-[#3AAFF0] hover:bg-[#007ACC] text-white px-5 py-2 rounded-full transition-colors font-medium"
            >
              Get Started
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t mt-2 py-4">
          <div className="container mx-auto px-4 flex flex-col space-y-4">
            <a
              href="#home"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </a>
            <a
              href="#benefits"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Benefits
            </a>
            <a
              href="#subscription"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Subscription
            </a>
            <a
              href="#how-to-use"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              How to Use
            </a>
            <a
              href="#contact"
              className="text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </a>
            <button
              onClick={() => {
                setShowSettingsModal(true);
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 text-gray-700 hover:text-[#3AAFF0] transition-colors font-medium px-4 py-2"
            >
              <Settings size={18} />
              Settings
            </button>
            <a
              href="#"
              className="bg-[#3AAFF0] hover:bg-[#007ACC] text-white px-5 py-2 rounded-full transition-colors font-medium mx-4"
              onClick={() => setIsMenuOpen(false)}
            >
              Get Started
            </a>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </header>
  );
};

export default Navbar;