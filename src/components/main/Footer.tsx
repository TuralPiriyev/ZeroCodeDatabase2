import { Database, Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <a href="#" className="flex items-center space-x-2 text-xl font-bold text-white mb-4">
              <Database className="h-6 w-6" />
              <span>Database Creator</span>
            </a>
            <p className="text-gray-400 mb-6">
              The visual tool for database design and management without the complexity.
            </p>
            <div className="flex items-center text-gray-400">
              <span>Made with</span>
              <Heart className="h-4 w-4 mx-1 text-red-400" />
              <span>for developers</span>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Tutorials
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Changelog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Status
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors">
                  GDPR
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Database Creator. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors text-sm">
              Privacy
            </a>
            <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors text-sm">
              Terms
            </a>
            <a href="#" className="text-gray-400 hover:text-[#3AAFF0] transition-colors text-sm">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;