import React from 'react';
import Navbar from '../components/main/Navbar';
import HeroSection from '../components/main/HeroSection';
import InfoSection from '../components/main/InfoSection';
import BenefitsSection from '../components/main/BenefitsSection';
import PlansSection from '../components/main/PlansSection';
import HowToSection from '../components/main/HowToSection';
import ContactForm from '../components/main/ContactForm';
import Footer from '../components/main/Footer';

export const MainPage: React.FC = () => {
   return (
    <div className="min-h-screen font-sans">
      <Navbar />
      <HeroSection />
      <InfoSection />
      <BenefitsSection />
      <PlansSection />
      <HowToSection />
      <ContactForm />
      <Footer />
    </div>
  );
};