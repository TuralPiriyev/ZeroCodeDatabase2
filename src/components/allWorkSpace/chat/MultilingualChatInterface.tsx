import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Lightbulb, Lock, Globe, Loader } from 'lucide-react';
import { useSubscription } from '../../../context/SubscriptionContext';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  language: string;
}

interface Language {
  code: string;
  name: string;
  flag: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const MultilingualChatInterface: React.FC = () => {
  const { canUseFeature, setShowUpgradeModal, setUpgradeReason } = useSubscription();
  
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message in selected language
    const welcomeMessages = {
      en: "Hi! I'm your multilingual database design assistant. I can help you with schema design, SQL queries, and database best practices in your preferred language. What would you like to know?",
      az: "Salam! Mən sizin çoxdilli verilənlər bazası dizayn köməkçinizəm. Sizə schema dizaynı, SQL sorğuları və verilənlər bazası ən yaxşı təcrübələri ilə kömək edə bilərəm. Nə bilmək istəyirsiniz?",
      tr: "Merhaba! Ben çok dilli veritabanı tasarım asistanınızım. Şema tasarımı, SQL sorguları ve veritabanı en iyi uygulamaları konularında tercih ettiğiniz dilde yardımcı olabilirim. Ne öğrenmek istiyorsunuz?",
      ru: "Привет! Я ваш многоязычный помощник по проектированию баз данных. Могу помочь с дизайном схем, SQL-запросами и лучшими практиками баз данных на вашем предпочитаемом языке. Что вы хотели бы узнать?",
      es: "¡Hola! Soy tu asistente multilingüe de diseño de bases de datos. Puedo ayudarte con el diseño de esquemas, consultas SQL y mejores prácticas de bases de datos en tu idioma preferido. ¿Qué te gustaría saber?",
      fr: "Salut! Je suis votre assistant multilingue de conception de bases de données. Je peux vous aider avec la conception de schémas, les requêtes SQL et les meilleures pratiques de bases de données dans votre langue préférée. Que souhaitez-vous savoir?",
      de: "Hallo! Ich bin Ihr mehrsprachiger Datenbankdesign-Assistent. Ich kann Ihnen bei Schema-Design, SQL-Abfragen und Datenbank-Best-Practices in Ihrer bevorzugten Sprache helfen. Was möchten Sie wissen?",
      zh: "你好！我是您的多语言数据库设计助手。我可以用您的首选语言帮助您进行模式设计、SQL查询和数据库最佳实践。您想了解什么？"
    };

    const welcomeMessage: Message = {
      id: '1',
      content: canUseFeature('canUseAI') 
        ? welcomeMessages[selectedLanguage.code as keyof typeof welcomeMessages] || welcomeMessages.en
        : "AI Assistant is available in Pro and Ultimate plans. Upgrade to get personalized help with your database design!",
      sender: 'ai',
      timestamp: new Date(),
      language: selectedLanguage.code,
    };

    setMessages([welcomeMessage]);
  }, [selectedLanguage, canUseFeature]);

  const suggestions = {
    en: [
      "Which column should be the primary key?",
      "How do I design a many-to-many relationship?",
      "What's the best way to handle user authentication?",
      "Should I normalize this table structure?",
    ],
    az: [
      "Hansı sütun əsas açar olmalıdır?",
      "Çox-çoxa əlaqəni necə dizayn etməliyəm?",
      "İstifadəçi autentifikasiyasını idarə etməyin ən yaxşı yolu nədir?",
      "Bu cədvəl strukturunu normallaşdırmalıyammı?",
    ],
    tr: [
      "Hangi sütun birincil anahtar olmalı?",
      "Çoktan-çoğa ilişkiyi nasıl tasarlarım?",
      "Kullanıcı kimlik doğrulamasını ele almanın en iyi yolu nedir?",
      "Bu tablo yapısını normalleştirmeli miyim?",
    ],
    ru: [
      "Какой столбец должен быть первичным ключом?",
      "Как спроектировать отношение многие-ко-многим?",
      "Как лучше всего обрабатывать аутентификацию пользователей?",
      "Стоит ли нормализовать эту структуру таблицы?",
    ],
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (!canUseFeature('canUseAI')) {
      setUpgradeReason('AI Assistant is available in Pro and Ultimate plans. Upgrade to get personalized help with your database design!');
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      language: selectedLanguage.code,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response with language-aware content
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputValue, selectedLanguage.code),
        sender: 'ai',
        timestamp: new Date(),
        language: selectedLanguage.code,
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string, languageCode: string): string => {
    const lowerInput = userInput.toLowerCase();
    
    // Language-specific responses
    const responses = {
      en: {
        primaryKey: "For primary keys, choose a column that:\n\n• Has unique values for each row\n• Never changes\n• Is not null\n• Preferably short and simple\n\nConsider using an auto-incrementing integer (ID) or UUID if no natural primary key exists.",
        manyToMany: "For many-to-many relationships:\n\n1. Create a junction/bridge table\n2. Include foreign keys from both related tables\n3. The combination of these foreign keys becomes the primary key\n4. Add any additional attributes specific to the relationship\n\nExample: Users ↔ Roles requires a UserRoles table with user_id and role_id.",
        normalize: "Database normalization guidelines:\n\n• 1NF: Eliminate repeating groups\n• 2NF: Remove partial dependencies\n• 3NF: Eliminate transitive dependencies\n\nBenefits: Reduces redundancy, improves data integrity\nDrawbacks: May require more complex queries\n\nBalance normalization with performance needs.",
        authentication: "For user authentication tables:\n\n• Store passwords as hashes (never plain text)\n• Include email, username, created_at, updated_at\n• Consider separate profile table for additional info\n• Add fields for email verification, password reset tokens\n• Include role/permission system if needed\n\nAlways follow security best practices!",
        default: "That's a great question! For database design, consider:\n\n• Data relationships and cardinality\n• Normalization vs. denormalization trade-offs\n• Indexing strategies for performance\n• Data types and constraints\n• Future scalability needs\n\nCould you provide more specific details about your schema challenge?"
      },
      az: {
        primaryKey: "Əsas açarlar üçün belə sütun seçin:\n\n• Hər sətir üçün unikal dəyərlərə malik\n• Heç vaxt dəyişməyən\n• Null olmayan\n• Tercihen qısa və sadə\n\nTəbii əsas açar yoxdursa, avtomatik artırılan tam ədəd (ID) və ya UUID istifadə etməyi düşünün.",
        manyToMany: "Çox-çoxa əlaqələr üçün:\n\n1. Birləşdirici/körpü cədvəli yaradın\n2. Hər iki əlaqəli cədvəldən xarici açarları daxil edin\n3. Bu xarici açarların kombinasiyası əsas açar olur\n4. Əlaqəyə xas əlavə atributlar əlavə edin\n\nMisal: İstifadəçilər ↔ Rollar user_id və role_id ilə UserRoles cədvəli tələb edir.",
        normalize: "Verilənlər bazası normallaşdırma qaydaları:\n\n• 1NF: Təkrarlanan qrupları aradan qaldırın\n• 2NF: Qismən asılılıqları aradan qaldırın\n• 3NF: Keçid asılılıqlarını aradan qaldırın\n\nFaydalar: Təkrarı azaldır, məlumat bütövlüyünü yaxşılaşdırır\nMənfi cəhətlər: Daha mürəkkəb sorğular tələb edə bilər\n\nNormallaşdırma ilə performans ehtiyaclarını balanslaşdırın.",
        authentication: "İstifadəçi autentifikasiya cədvəlləri üçün:\n\n• Parolları hash kimi saxlayın (heç vaxt açıq mətn)\n• Email, username, created_at, updated_at daxil edin\n• Əlavə məlumat üçün ayrı profil cədvəli düşünün\n• Email təsdiqi, parol sıfırlama tokenləri üçün sahələr əlavə edin\n• Lazım olduqda rol/icazə sistemi daxil edin\n\nHəmişə təhlükəsizlik ən yaxşı təcrübələrini izləyin!",
        default: "Bu əla sualdır! Verilənlər bazası dizaynı üçün nəzərə alın:\n\n• Məlumat əlaqələri və kardinallik\n• Normallaşdırma vs denormallaşdırma kompromisləri\n• Performans üçün indeksləşdirmə strategiyaları\n• Məlumat növləri və məhdudiyyətlər\n• Gələcək miqyaslanma ehtiyacları\n\nSchema probleminiz haqqında daha konkret təfərrüatlar verə bilərsinizmi?"
      },
      tr: {
        primaryKey: "Birincil anahtarlar için şu özelliklere sahip sütunu seçin:\n\n• Her satır için benzersiz değerlere sahip\n• Hiç değişmeyen\n• Null olmayan\n• Tercihen kısa ve basit\n\nDoğal birincil anahtar yoksa, otomatik artan tamsayı (ID) veya UUID kullanmayı düşünün.",
        manyToMany: "Çoktan-çoğa ilişkiler için:\n\n1. Bağlantı/köprü tablosu oluşturun\n2. İlgili her iki tablodan yabancı anahtarları dahil edin\n3. Bu yabancı anahtarların kombinasyonu birincil anahtar olur\n4. İlişkiye özgü ek öznitelikler ekleyin\n\nÖrnek: Kullanıcılar ↔ Roller, user_id ve role_id ile UserRoles tablosu gerektirir.",
        normalize: "Veritabanı normalleştirme kuralları:\n\n• 1NF: Tekrarlayan grupları ortadan kaldırın\n• 2NF: Kısmi bağımlılıkları kaldırın\n• 3NF: Geçişli bağımlılıkları ortadan kaldırın\n\nFaydalar: Tekrarı azaltır, veri bütünlüğünü iyileştirir\nDezavantajlar: Daha karmaşık sorgular gerektirebilir\n\nNormalleştirme ile performans ihtiyaçlarını dengeleyin.",
        authentication: "Kullanıcı kimlik doğrulama tabloları için:\n\n• Şifreleri hash olarak saklayın (asla düz metin)\n• Email, username, created_at, updated_at dahil edin\n• Ek bilgi için ayrı profil tablosu düşünün\n• Email doğrulama, şifre sıfırlama tokenları için alanlar ekleyin\n• Gerektiğinde rol/izin sistemi dahil edin\n\nHer zaman güvenlik en iyi uygulamalarını takip edin!",
        default: "Bu harika bir soru! Veritabanı tasarımı için şunları düşünün:\n\n• Veri ilişkileri ve kardinalite\n• Normalleştirme vs denormalleştirme ödünleri\n• Performans için indeksleme stratejileri\n• Veri türleri ve kısıtlamalar\n• Gelecekteki ölçeklenebilirlik ihtiyaçları\n\nŞema zorluğunuz hakkında daha spesifik ayrıntılar verebilir misiniz?"
      },
      ru: {
        primaryKey: "Для первичных ключей выберите столбец, который:\n\n• Имеет уникальные значения для каждой строки\n• Никогда не изменяется\n• Не является null\n• Предпочтительно короткий и простой\n\nРассмотрите использование автоинкрементного целого числа (ID) или UUID, если нет естественного первичного ключа.",
        manyToMany: "Для отношений многие-ко-многим:\n\n1. Создайте соединительную/промежуточную таблицу\n2. Включите внешние ключи из обеих связанных таблиц\n3. Комбинация этих внешних ключей становится первичным ключом\n4. Добавьте любые дополнительные атрибуты, специфичные для отношения\n\nПример: Пользователи ↔ Роли требует таблицу UserRoles с user_id и role_id.",
        normalize: "Руководящие принципы нормализации базы данных:\n\n• 1НФ: Устраните повторяющиеся группы\n• 2НФ: Удалите частичные зависимости\n• 3НФ: Устраните транзитивные зависимости\n\nПреимущества: Уменьшает избыточность, улучшает целостность данных\nНедостатки: Может потребовать более сложных запросов\n\nБалансируйте нормализацию с потребностями производительности.",
        authentication: "Для таблиц аутентификации пользователей:\n\n• Храните пароли как хеши (никогда в открытом тексте)\n• Включите email, username, created_at, updated_at\n• Рассмотрите отдельную таблицу профиля для дополнительной информации\n• Добавьте поля для подтверждения email, токенов сброса пароля\n• Включите систему ролей/разрешений при необходимости\n\nВсегда следуйте лучшим практикам безопасности!",
        default: "Это отличный вопрос! Для проектирования базы данных рассмотрите:\n\n• Отношения данных и кардинальность\n• Компромиссы нормализации vs денормализации\n• Стратегии индексирования для производительности\n• Типы данных и ограничения\n• Будущие потребности масштабируемости\n\nМожете ли вы предоставить более конкретные детали о вашей проблеме схемы?"
      }
    };

    const langResponses = responses[languageCode as keyof typeof responses] || responses.en;
    
    if (lowerInput.includes('primary key') || lowerInput.includes('əsas açar') || lowerInput.includes('birincil anahtar') || lowerInput.includes('первичный ключ')) {
      return langResponses.primaryKey;
    }
    
    if (lowerInput.includes('many-to-many') || lowerInput.includes('çox-çoxa') || lowerInput.includes('çoktan-çoğa') || lowerInput.includes('многие-ко-многим')) {
      return langResponses.manyToMany;
    }
    
    if (lowerInput.includes('normalize') || lowerInput.includes('normallaş') || lowerInput.includes('normalleş') || lowerInput.includes('нормализ')) {
      return langResponses.normalize;
    }
    
    if (lowerInput.includes('authentication') || lowerInput.includes('autentifikasiya') || lowerInput.includes('kimlik doğrulama') || lowerInput.includes('аутентификация')) {
      return langResponses.authentication;
    }
    
    return langResponses.default;
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!canUseFeature('canUseAI')) {
      setUpgradeReason('AI Assistant is available in Pro and Ultimate plans. Upgrade to get personalized help with your database design!');
      setShowUpgradeModal(true);
      return;
    }
    setInputValue(suggestion);
  };

  const currentSuggestions = suggestions[selectedLanguage.code as keyof typeof suggestions] || suggestions.en;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Language Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              canUseFeature('canUseAI') 
                ? 'bg-blue-100 dark:bg-blue-900' 
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              {canUseFeature('canUseAI') ? (
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Lock className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Multilingual AI Assistant
                {!canUseFeature('canUseAI') && (
                  <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                    Pro Feature
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {canUseFeature('canUseAI') 
                  ? 'Get help in your preferred language'
                  : 'Upgrade to Pro for multilingual AI assistance'
                }
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              disabled={!canUseFeature('canUseAI')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors duration-200 ${
                canUseFeature('canUseAI')
                  ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="text-lg">{selectedLanguage.flag}</span>
              <span className="text-sm font-medium">{selectedLanguage.name}</span>
            </button>

            {showLanguageDropdown && canUseFeature('canUseAI') && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowLanguageDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      onClick={() => {
                        setSelectedLanguage(language);
                        setShowLanguageDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
                        selectedLanguage.code === language.code ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <span className="text-lg">{language.flag}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{language.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'ai' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                canUseFeature('canUseAI') 
                  ? 'bg-blue-100 dark:bg-blue-900' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {canUseFeature('canUseAI') ? (
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-500" />
                )}
              </div>
            )}
            
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg whitespace-pre-line ${
                message.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
              }`}
            >
              {message.content}
            </div>
            
            {message.sender === 'user' && (
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && canUseFeature('canUseAI') && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedLanguage.code === 'az' ? 'Sual verin:' : 
               selectedLanguage.code === 'tr' ? 'Soru sorun:' :
               selectedLanguage.code === 'ru' ? 'Попробуйте спросить:' :
               'Try asking:'}
            </span>
          </div>
          <div className="space-y-2">
            {currentSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input - Fixed at bottom */}
      <div className="sticky bottom-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                canUseFeature('canUseAI') 
                  ? (selectedLanguage.code === 'az' ? 'Schema dizaynı haqqında soruşun...' :
                     selectedLanguage.code === 'tr' ? 'Şema tasarımı hakkında sorun...' :
                     selectedLanguage.code === 'ru' ? 'Спросите о дизайне схемы...' :
                     'Ask about schema design...')
                  : 'Upgrade to Pro for multilingual AI assistance'
              }
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm shadow-sm"
              disabled={isTyping || !canUseFeature('canUseAI')}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping || !canUseFeature('canUseAI')}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            {isTyping ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      
    </div>
  );
};

export default MultilingualChatInterface;