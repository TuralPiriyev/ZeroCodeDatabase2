import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RegisterFormValues {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onLoginClick: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onLoginClick }) => {
  const navigate = useNavigate();
  const { register: registerUser,  authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
  } = useForm<RegisterFormValues>({
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange', // Dəyişikliklər zamanı yenidən validasiya
  });

  const password = watch('password');

  // Autofill dəyərlərini aşkar etmək üçün
  useEffect(() => {
    const timer = setTimeout(() => {
      trigger(); // Validasiyanı əl ilə tetikləyir
    }, 100); // 100ms gecikmə
    return () => clearTimeout(timer);
  }, [trigger]);

  const onSubmit = async (data: RegisterFormValues) => {
    console.log('Form data:', data); // Dəyərləri yoxlamaq üçün
    console.log('Form errors:', errors); // Xətaları yoxlamaq üçün
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...userData } = data;
      await registerUser(userData);
      navigate(`/verify?email=${encodeURIComponent(userData.email)}`);
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5">
      <div className="flex flex-col gap-4">
        <Input
          label="Full Name"
          leftIcon={<User size={18} />}
          placeholder="Enter your full name"
          error={errors.fullName?.message}
          fullWidth
          {...register('fullName', {
            required: 'Full name is required',
          })}
        />

        <Input
          label="Username"
          leftIcon={<User size={18} />}
          placeholder="Choose a username"
          error={errors.username?.message}
          fullWidth
          {...register('username', {
            required: 'Username is required',
            minLength: {
              value: 3,
              message: 'Username must be at least 3 characters',
            },
            pattern: {
              value: /^[a-zA-Z0-9_]+$/,
              message: 'Username can only contain letters, numbers, and underscores',
            },
          })}
        />

        <Input
          label="Email"
          type="email"
          leftIcon={<Mail size={18} />}
          placeholder="Enter your email"
          error={errors.email?.message}
          fullWidth
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Please enter a valid email',
            },
          })}
        />

        <Input
          label="Phone"
          type="tel"
          leftIcon={<Phone size={18} />}
          placeholder="Enter your phone number"
          error={errors.phone?.message}
          fullWidth
          {...register('phone', {
            required: 'Phone number is required',
            pattern: {
              value: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
              message: 'Please enter a valid phone number',
            },
          })}
        />

        <Input
          label="Password"
          type="password"
          leftIcon={<Lock size={18} />}
          placeholder="Create a password"
          error={errors.password?.message}
          fullWidth
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters',
            },
          })}
        />

        <Input
          label="Confirm Password"
          type="password"
          leftIcon={<Lock size={18} />}
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          fullWidth
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: value => 
              value === password || 'The passwords do not match',
          })}
        />
      </div>

      {authError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {authError}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
      >
        Create Account
      </Button>

      <div className="text-center">
        <span className="text-sm text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            onClick={onLoginClick}
          >
            Sign in
          </button>
        </span>
      </div>
    </form>
  );
};