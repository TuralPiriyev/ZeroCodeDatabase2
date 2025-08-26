// contactForm.tsx
import { useState } from 'react';
import { Send, Mail, MessageSquare, Github, Twitter, Linkedin } from 'lucide-react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Network response was not ok');
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Get in <span className="text-[#3AAFF0]">Touch</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Have questions about Database Creator? Reach out to us and we'll get back to you as soon as possible.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-12 max-w-6xl mx-auto">
          <div className="md:w-1/2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3AAFF0] focus:border-transparent outline-none transition-all"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3AAFF0] focus:border-transparent outline-none transition-all"
                  placeholder="Your email"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3AAFF0] focus:border-transparent outline-none transition-all"
                  placeholder="Your message"
                ></textarea>
              </div>
              
              <button
                type="submit"
                disabled={status === 'sending'}
                className="bg-[#3AAFF0] hover:bg-[#007ACC] text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center transition-colors w-full md:w-auto"
              >
                {status === 'sending' ? 'Sending…' : 'Send Message'}
                <Send className="ml-2 h-4 w-4" />
              </button>
            </form>

            {status === 'success' && (
              <p className="mt-4 text-green-600">Thank you! Your message has been sent.</p>
            )}
            {status === 'error' && (
              <p className="mt-4 text-red-600">Something went wrong. Please try again.</p>
            )}
          </div>
          
          <div className="md:w-1/2 bg-[#E6F7FF] rounded-3xl p-8">
            {/* (Bu hissə tamamilə dəyişməz qaldı) */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Contact Information</h3>
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-white p-3 rounded-full shadow-md mr-4">
                  <Mail className="h-6 w-6 text-[#3AAFF0]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Email</h4>
                  <a href="mailto:piriyevtural00@gmail.com" className="text-[#3AAFF0] hover:text-[#007ACC]">
                    piriyevtural00@gmail.com
                  </a>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-white p-3 rounded-full shadow-md mr-4">
                  <MessageSquare className="h-6 w-6 text-[#3AAFF0]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Support</h4>
                  <a href="mailto:piriyevtural00@gmail.com" className="text-[#3AAFF0] hover:text-[#007ACC]">
                    piriyevtural00@gmail.com
                  </a>
                </div>
              </div>
            </div>
            
            <div className="mt-10">
              <h4 className="font-semibold text-gray-800 mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="bg-white p-3 rounded-full shadow-md text-[#3AAFF0] hover:text-white hover:bg-[#3AAFF0] transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="bg-white p-3 rounded-full shadow-md text-[#3AAFF0] hover:text-white hover:bg-[#3AAFF0] transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" className="bg-white p-3 rounded-full shadow-md text-[#3AAFF0] hover:text-white hover:bg-[#3AAFF0] transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div className="mt-10 p-6 bg-white rounded-2xl shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-3">Office Hours</h4>
              <p className="text-gray-600 mb-2">Monday - Friday: 9am - 6pm EST</p>
              <p className="text-gray-600">We typically respond within 24 hours</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
