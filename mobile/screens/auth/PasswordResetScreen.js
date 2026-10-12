import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import FormField from '../../components/FormField';
import AppButton from '../../components/AppButton';
import { useAuthStyles } from './authStyles';
import { useAuthStore } from '../../store/useAuthStore';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export default function PasswordResetScreen({ onBack }) {
  const authStyles = useAuthStyles();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const loading = useAuthStore((s) => s.loading);
  const authError = useAuthStore((s) => s.authError);
  const authSuccess = useAuthStore((s) => s.authSuccess);

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);

  const handleSubmit = async () => {
    if (!validateEmail(email)) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError(null);
    await resetPassword(email);
  };

  return (
    <ScrollView style={authStyles.root} contentContainerStyle={authStyles.content}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to sign in" style={authStyles.backBtn}>
        <Text style={authStyles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={authStyles.title} accessibilityRole="header" aria-level={1}>
        Reset your password
      </Text>
      <Text style={authStyles.subtitle}>If an account uses this email, we'll send a link to reset the password.</Text>

      {authError ? (
        <Text style={authStyles.bannerError} accessibilityRole="alert">
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
          error={fieldError}
        />
        <AppButton label="Send reset link" variant="primary" onPress={handleSubmit} loading={loading} />
      </View>
    </ScrollView>
  );
}
