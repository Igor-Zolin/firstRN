import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          onPress={onSubmit}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
                  onPress={() => router.replace('/register')}
                  style={styles.linkBtn}
                >
                  <Text style={styles.linkText}>Don't have an account? Sign up</Text>
                </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  linkBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    color: 'rgba(226,232,240,0.75)',
    fontSize: 13,
  },

  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#12121A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 16,
    textAlign: 'center',
  },

  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0F0F17',
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },

  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: 0.5,
  },

  error: {
    color: '#f33f32',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
});