import { Play, FileText, Video } from 'lucide-react';

const HowToSection = () => {
  return (
    <section id="how-to-use" className="py-16 md:py-24 bg-[#E6F7FF]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            How to <span className="text-[#3AAFF0]">Use</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Watch our quick tutorial to learn how to create and manage your database tables using Database Creator.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          {/* YouTube Video Embed Frame */}
          <div className="lg:w-7/12 w-full">
            <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-xl">
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/OfjJAfXfE9o"
                title="ZeroCodeDB Tutorial Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>
          </div>

          <div className="lg:w-5/12 w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Getting Started is Easy
            </h3>
            
            <div className="space-y-6">
              <div className="flex">
                <div className="flex-shrink-0 h-12 w-12 bg-[#3AAFF0] rounded-full flex items-center justify-center text-white font-bold mr-4">
                  1
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">Create a New Database</h4>
                  <p className="text-gray-600">Start by creating a new database project and giving it a name.</p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 h-12 w-12 bg-[#3AAFF0] rounded-full flex items-center justify-center text-white font-bold mr-4">
                  2
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">Add Tables and Fields</h4>
                  <p className="text-gray-600">Use the visual designer to add tables and define fields with their data types.</p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 h-12 w-12 bg-[#3AAFF0] rounded-full flex items-center justify-center text-white font-bold mr-4">
                  3
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">Define Relationships</h4>
                  <p className="text-gray-600">Connect tables to establish relationships between your data entities.</p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 h-12 w-12 bg-[#3AAFF0] rounded-full flex items-center justify-center text-white font-bold mr-4">
                  4
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">Export Your Schema</h4>
                  <p className="text-gray-600">Export your database schema to SQL or other formats ready for implementation.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#" className="flex items-center text-[#3AAFF0] hover:text-[#007ACC] font-medium">
                <FileText className="h-5 w-5 mr-2" />
                Read Documentation
              </a>
              <a 
                href="https://youtu.be/OfjJAfXfE9o" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center text-[#3AAFF0] hover:text-[#007ACC] font-medium"
              >
                <Video className="h-5 w-5 mr-2" />
                Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowToSection;
