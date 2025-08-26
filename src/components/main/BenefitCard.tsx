import { DivideIcon as LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface BenefitCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const BenefitCard = ({ icon, title, description }: BenefitCardProps) => {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl hover:transform hover:translate-y-[-5px]">
      <div className="bg-[#E6F7FF] p-4 rounded-2xl inline-block mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default BenefitCard;