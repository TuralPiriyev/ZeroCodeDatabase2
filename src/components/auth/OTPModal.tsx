import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, ArrowRight, Shield } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  error?: string;
  remainingAttempts?: number;
  cooldownSeconds?: number;
}

export const OTPModal: React.FC<OTPModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  onResend,
  error,
  remainingAttempts = 5,
  cooldownSeconds = 0
}) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(cooldownSeconds);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setResendCooldown(cooldownSeconds);
  }, [cooldownSeconds]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return; // Handle paste later
    if (!/^\d*$/.test(value)) return; // Numbers only

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  const handleSubmit = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) return;

    setIsSubmitting(true);
    try {
      await onVerify(otpString);
    } catch (error) {
      console.error('OTP verification failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await onResend();
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Failed to resend OTP:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-600">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {otp.map((digit, idx) => (
            <Input
              key={idx}
              ref={el => (inputRefs.current[idx] = el)}
              type="text"
              maxLength={1}
              label={`Digit ${idx + 1}`}
              value={digit}
              onChange={e => handleInputChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className="w-12 h-12 text-center text-xl font-bold"
              error={error ? ' ' : undefined}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {remainingAttempts < 5 && (
          <p className="text-sm text-gray-600 mb-4">
            {remainingAttempts} attempts remaining
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={otp.join('').length !== 6 || isSubmitting}
          isLoading={isSubmitting}
          fullWidth
          className="mb-4"
        >
          {isSubmitting ? (
            'Verifying...'
          ) : (
            <>
              Verify Code
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        <div className="text-center">
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className={`text-blue-600 hover:text-blue-700 text-sm ${
              resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  );
};