import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Database,
  Shield,
  CheckCircle,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export const VerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyCode, requestResend, authError, isLoading: authLoading, getCurrentUserEmail } = useAuth();

  const [emailToVerify, setEmailToVerify] = useState<string | null>(null);
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmailToVerify(emailParam);
    else if (getCurrentUserEmail) {
      const stored = getCurrentUserEmail();
      if (stored) setEmailToVerify(stored);
    }
  }, [searchParams, getCurrentUserEmail]);

  useEffect(() => {
    setIsComplete(code.every(d => d !== ''));
  }, [code]);

  const handleInputChange = (i: number, val: string) => {
    if (val.length > 1) return;
    if (hasError) setHasError(false);
    const updated = [...code];
    updated[i] = val;
    setCode(updated);
    if (val && i < code.length - 1) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const onVerify = async () => {
    if (!emailToVerify) return;
    setIsShaking(false);
    try {
      await verifyCode(emailToVerify, code.join(''));
      navigate('/main');
    } catch (err) {
      setHasError(true);
      triggerShake();
    }
  };

  const onResend = async () => {
    if (!emailToVerify) return;
    setCode(['', '', '', '', '', '']);
    setIsComplete(false);
    setHasError(false);
    inputRefs.current[0]?.focus();
    await requestResend(emailToVerify);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Background blobs & pattern omitted for brevity, can re-add if needed */}
      <div className="relative z-10 flex items-center justify-center p-4 min-h-screen">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AutoScripting DB
              </span>
            </h1>
            <p className="text-gray-600">Enter verification code</p>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <>{/* Verification Inputs */}</>
            <div className={`flex justify-center gap-3 mb-6 ${isShaking ? 'animate-shake' : ''}`}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleInputChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all duration-200 focus:outline-none ${
                    hasError
                      ? 'border-red-500 bg-red-50 text-red-700 shadow-md'
                      : digit
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 focus:border-blue-500'
                  }`}
                />
              ))}
            </div>

            {authError || hasError ? (
              <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {authError || 'Invalid code, please try again.'}
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-6">
              <Shield className="w-4 h-4" />
              <span>6-digit verification code</span>
            </div>

            <button
              onClick={onVerify}
              disabled={!isComplete || authLoading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                isComplete && !authLoading
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </div>
              ) : (
                <>
                  <span>Verify Code</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center mt-6">
              <button
                onClick={onResend}
                disabled={authLoading}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
              >
                Resend code
              </button>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0);}10%,30%,50%,70%,90%{transform:translateX(-4px);}20%,40%,60%,80%{transform:translateX(4px);} }
        .animate-shake { animation: shake 0.6s ease-in-out; }
      `}</style>
    </div>
  );
};
