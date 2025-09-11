import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Lightbulb, Lock, Globe, Loader } from 'lucide-react';
import { useSubscription } from '../../../context/SubscriptionContext';
import { isLikelyDbQuestion } from '../../../utils/dbClassifier';

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

    // Quick heuristic: if the classifier says it's unlikely and the question is short,
    // immediately reject locally without calling the backend. For longer/uncertain inputs
    // we still send to backend so the server can do a stronger model classification.
    const trimmed = inputValue.trim();
    const likely = isLikelyDbQuestion(trimmed);
    const shortThreshold = 30;

    if (!likely && trimmed.length < shortThreshold) {
      // show localized rejection
      const rejection = REJECTION_MESSAGES[selectedLanguage.code as keyof typeof REJECTION_MESSAGES] || REJECTION_MESSAGES.en;
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: rejection,
        sender: 'ai',
        timestamp: new Date(),
        language: selectedLanguage.code,
      };
      setMessages(prev => [...prev, aiResponse]);
      return;
    }

    setIsTyping(true);

    try {
      const contextSuggestions: string[] = [];
      // If the typed question exactly equals one of the suggestion texts, send it as contextSuggestions
      const currentSuggestions = suggestions[selectedLanguage.code as keyof typeof suggestions] || suggestions.en;
      if (currentSuggestions.includes(trimmed)) {
        contextSuggestions.push(trimmed);
      }

      const result = await sendToAI(trimmed, selectedLanguage.code, undefined, contextSuggestions.length ? contextSuggestions : undefined);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: result.answer,
        sender: 'ai',
        timestamp: new Date(),
        language: selectedLanguage.code,
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const svc = SERVICE_UNAVAILABLE[selectedLanguage.code as keyof typeof SERVICE_UNAVAILABLE] || SERVICE_UNAVAILABLE.en;
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: svc,
        sender: 'ai',
        timestamp: new Date(),
        language: selectedLanguage.code,
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  // generateAIResponse removed: replaced with server-backed requests

  const handleSuggestionClick = (suggestion: string) => {
    if (!canUseFeature('canUseAI')) {
      setUpgradeReason('AI Assistant is available in Pro and Ultimate plans. Upgrade to get personalized help with your database design!');
      setShowUpgradeModal(true);
      return;
    }
  setInputValue(suggestion);
  // If the suggestion is clicked we can auto-send it as a user message for convenience
  // (maintain current UX: fill the input and let user press send)
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

// Localized rejection and service messages (shared with server)
const REJECTION_MESSAGES: Record<string, string> = {
  en: "I only answer questions related to databases (SQL and database programming).",
  az: "Mən yalnız verilənlər bazası (SQL və verilənlər bazası proqramlaşdırması) ilə bağlı suallara cavab verirəm.",
  tr: "Sadece veritabanı (SQL ve veritabanı programlama) ile ilgili soruları cevaplıyorum.",
  ru: "Я отвечаю только на вопросы, связанные с базами данных (SQL и программированием баз данных).",
};

const SERVICE_UNAVAILABLE: Record<string, string> = {
  en: "Service temporarily unavailable. Try again later.",
  az: "Xidmət müvəqqəti əlçatan deyil. Sonra yenidən cəhd edin.",
};

async function sendToAI(question: string, language: string, userId?: string, contextSuggestions?: string[]): Promise<{ answer: string }> {
  const payload: any = { question, language };
  if (userId) payload.userId = userId;
  if (contextSuggestions) payload.contextSuggestions = contextSuggestions;
  // Determine API base from environment (CRA: REACT_APP_API_BASE, Vite: VITE_API_BASE_URL)
  const reactBase = (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_API_BASE as string)) || '';
  const viteBase = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_BASE_URL as string)) || '';
  const apiBase = (reactBase || viteBase || '').toString();

  // Safe join to avoid double slashes
  const joinUrl = (base: string, path: string) => {
    if (!base) return path.startsWith('/') ? path : `/${path}`;
    const b = base.replace(/\/$/, '');
    const p = path.replace(/^\//, '');
    return `${b}/${p}`;
  };

  const url = joinUrl(apiBase, '/api/ai/dbquery');

  // Dev-only logging to help debug 404s; does not print secrets
  if ((typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') || (typeof window !== 'undefined' && (window as any).__DEV__)) {
    // __DEV__ can be set in client dev environments if needed
    try {
      // Avoid logging sensitive fields; payload here doesn't contain secrets
      // but we still only log in development
      // eslint-disable-next-line no-console
      console.log('[MultilingualChat] POST', url, payload);
    } catch (e) {}
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // In development provide some debug text
    if ((typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development')) {
      const txt = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('[MultilingualChat] fetch error', res.status, txt);
    }
    throw new Error('Service error');
  }

  const json = await res.json();
  // support health responder or answer payload
  return { answer: (json.answer as string) || (json.status as string) || '' };
}

export default MultilingualChatInterface;