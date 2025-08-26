import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LoginFormValues {
  email: string;
  password: string;
}

interface LoginFormProps {
  onRegisterClick: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onRegisterClick }) => {
  const navigate = useNavigate();
  const { login, authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      navigate('/main');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5">
      <div className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          leftIcon={<Mail size={18} />}
          placeholder="Enter your email"
          error={errors.email?.message}
          fullWidth
          {...register('email', {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Please enter a valid email',
            },
          })}
        />

        <Input
          label="Password"
          type="password"
          leftIcon={<Lock size={18} />}
          placeholder="Enter your password"
          error={errors.password?.message}
          fullWidth
          {...register('password', {
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters',
            },
          })}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
          onClick={() => alert('Password reset functionality would be here')}
        >
          Forgot password?
        </button>
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
        Sign In
      </Button>

      <div className="text-center">
        <span className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            onClick={onRegisterClick}
          >
            Register
          </button>
        </span>
      </div>
    </form>
  );
};