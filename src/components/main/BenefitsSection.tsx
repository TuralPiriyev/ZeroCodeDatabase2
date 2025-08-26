import BenefitCard from './BenefitCard';
import { Code, Rocket, GraduationCap, Building2, Briefcase } from 'lucide-react';

const BenefitsSection = () => {
  const benefits = [
    {
      icon: <Code className="h-8 w-8 text-[#007ACC]" />,
      title: 'Developers',
      description: 'Streamline database planning and design without writing complex SQL queries manually.',
    },
    {
      icon: <Rocket className="h-8 w-8 text-[#007ACC]" />,
      title: 'Startups',
      description: 'Quickly iterate on your database architecture as your product requirements evolve.',
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-[#007ACC]" />,
      title: 'Students',
      description: 'Learn database concepts visually with an intuitive interface for better understanding.',
    },
    {
      icon: <Building2 className="h-8 w-8 text-[#007ACC]" />,
      title: 'SaaS Teams',
      description: 'Collaborate on database schema design with visual tools that everyone can understand.',
    },
    {
      icon: <Briefcase className="h-8 w-8 text-[#007ACC]" />,
      title: 'Small Businesses',
      description: 'Create custom databases for your specific needs without hiring database specialists.',
    },
  ];

  return (
    <section id="benefits" className="py-16 md:py-24 bg-[#E6F7FF]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Who is this <span className="text-[#3AAFF0]">for?</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Database Creator is designed for anyone who needs to work with databases without the complexity
            of writing raw SQL or dealing with complex database management systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <BenefitCard
              key={index}
              icon={benefit.icon}
              title={benefit.title}
              description={benefit.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;