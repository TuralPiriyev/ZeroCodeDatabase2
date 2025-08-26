import { Check } from 'lucide-react';
import React from 'react';

interface PlanCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaText?: string;
  onSelect?: () => void;
}

const PlanCard = ({
  title,
  price,
  description,
  features,
  highlighted = false,
  ctaText = 'Choose Plan',
  onSelect,
}: PlanCardProps) => {
  return (
    <div
      className={`rounded-3xl overflow-hidden transition-all duration-300 ${
        highlighted
          ? 'bg-gradient-to-b from-[#007ACC] to-[#3AAFF0] text-white shadow-xl transform hover:scale-105'
          : 'bg-white border border-gray-200 hover:shadow-xl'
      }`}
    >
      {highlighted && (
        <div className="bg-[#007ACC] text-white text-center py-2 text-sm font-medium">
          Most Popular
        </div>     
      )}
      <div className="p-8">
        <h3 className={`text-2xl font-bold mb-2 ${highlighted ? 'text-white' : 'text-gray-800'}`}>
          {title}
        </h3>
        <div className="mb-4">
          <span className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-gray-800'}`}>
            {price}
          </span>
          {price !== 'Free' && (
            <span className={`text-sm ${highlighted ? 'text-white opacity-90' : 'text-gray-500'}`}>
              /month
            </span>
          )}
        </div>
        <p
          className={`mb-6 ${
            highlighted ? 'text-white opacity-90' : 'text-gray-600'
          }`}
        >
          {description}
        </p>
        <div className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start">
              <Check 
                className={`h-5 w-5 mr-2 flex-shrink-0 ${
                  highlighted ? 'text-white' : 'text-[#3AAFF0]'
                }`} 
              />
              <span
                className={`text-sm ${
                  highlighted ? 'text-white opacity-90' : 'text-gray-600'
                }`}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>
        <button
         onClick={onSelect}
          className={`w-full py-3 rounded-full font-medium transition-colors ${
            highlighted
              ? 'bg-white text-[#007ACC] hover:bg-gray-100'
              : 'bg-[#3AAFF0] text-white hover:bg-[#007ACC]'
          }`}
        >
          {ctaText}
        </button>
      </div>
    </div>
  );
};

export default PlanCard;