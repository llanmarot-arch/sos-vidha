import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import FormField from '../../components/FormField';
import AppButton from '../../components/AppButton';
import { useAuthStyles } from './authStyles';
import { useAuthStore } from '../../store/useAuthStore';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export default function RegisterScreen({ onBack }) {
  const authStyles = useAuthStyles();
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.authError);
  const authSuccess = useAuthStore((s) => s.authSuccess);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!fullName.trim()) nextErrors.fullName = 'Please enter your name.';
    if (!validateEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password || password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await signUp({ email, password, fullName });
  };

  return (
    <ScrollView style={authStyles.root} contentContainerStyle={authStyles.content}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={authStyles.backBtn}>
        <Text style={authStyles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={authStyles.title} accessibilityRole="header" aria-level={1}>
        Create an account
      </Text>
      <Text style={authStyles.subtitle}>We'll send you an email to confirm your address.</Text>

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
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          error={fieldErrors.fullName}
        />
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
          hint="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          error={fieldErrors.password}
        />
        <AppButton label="Create account" variant="primary" onPress={handleSubmit} loading={loading} />
      </View>
    </ScrollView>
  );
}
