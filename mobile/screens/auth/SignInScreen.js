import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import FormField from '../../components/FormField';
import AppButton from '../../components/AppButton';
import { authStyles } from './authStyles';
import { useAuthStore } from '../../store/useAuthStore';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export default function SignInScreen({ onBack, onForgotPassword }) {
  const signIn = useAuthStore((s) => s.signIn);
  const loading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.authError);
  const authSuccess = useAuthStore((s) => s.authSuccess);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!validateEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password || password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await signIn({ email, password });
  };

  return (
    <ScrollView style={authStyles.root} contentContainerStyle={authStyles.content}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={authStyles.backBtn}>
        <Text style={authStyles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={authStyles.title} accessibilityRole="header" aria-level={1}>
        Sign in
      </Text>
      <Text style={authStyles.subtitle}>Welcome back. Sign in to see your contacts and safety settings.</Text>

      {authError ? (
        <Text style={authStyles.bannerError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {authError}
        </Text>
      ) : null}
      {authSuccess ? (
        <Text style={authStyles.bannerSuccess} accessibilityLiveRegion="polite">
          {authSuccess}
        </Text>
      ) : null}

      <View style={authStyles.card}>
        <FormField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <AppButton label="Sign in" variant="primary" onPress={handleSubmit} loading={loading} />
      </View>
      <TouchableOpacity onPress={onForgotPassword} accessibilityRole="link" style={authStyles.linkBtn}>
        <Text style={authStyles.link}>Forgot your password?</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
