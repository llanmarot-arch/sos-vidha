import React from 'react';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import PasswordResetScreen from '../screens/auth/PasswordResetScreen';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthFlow() {
  const authView = useAuthStore((s) => s.authView);
  const setAuthView = useAuthStore((s) => s.setAuthView);

  switch (authView) {
    case 'signin':
      return (
        <SignInScreen
          onBack={() => setAuthView('welcome')}
          onForgotPassword={() => setAuthView('reset')}
        />
      );
    case 'register':
      return <RegisterScreen onBack={() => setAuthView('welcome')} />;
    case 'reset':
      return <PasswordResetScreen onBack={() => setAuthView('signin')} />;
    default:
      return (
        <WelcomeScreen
          onSignIn={() => setAuthView('signin')}
          onCreateAccount={() => setAuthView('register')}
        />
      );
  }
}
