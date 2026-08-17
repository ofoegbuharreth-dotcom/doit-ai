import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type Props = {
  onTranscript: (text: string) => void;
  compact?: boolean;
};

export function VoiceCaptureButton({ onTranscript, compact = false }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  useSpeechRecognitionEvent('start', () => { setListening(true); setError(''); });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    setError(event.message || 'Voice capture failed.');
  });

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is needed for voice capture.');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true, continuous: false });
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Capture with voice'} onPress={toggle} style={[styles.button, compact && styles.compact, listening && styles.listening]}>
        {listening ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Ionicons name="mic" color={colors.textPrimary} size={compact ? 19 : 21} />}
        {!compact ? <Text variant="label">{listening ? 'Listening…' : 'Speak it'}</Text> : null}
      </Pressable>
      {error && !compact ? <Text variant="caption" color="danger">{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.md },
  compact: { alignSelf: 'auto', borderRadius: 20, height: 40, justifyContent: 'center', minHeight: 40, paddingHorizontal: 0, width: 40 },
  listening: { backgroundColor: colors.accent, borderColor: colors.accent },
});
