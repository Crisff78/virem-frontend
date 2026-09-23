import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import ConnectionStatus from '../../components/video/ConnectionStatus';
import JitsiVideoContainer from '../../components/video/JitsiVideoContainer';
import { useVideoCall } from '../../hooks/useVideoCall';
import { useCallSignaler } from '../../hooks/useCallSignaling';
import { useAppointmentVideoAccess, formatCountdown } from '../../hooks/useAppointmentVideoAccess';
import type { RootStackParamList } from '../../navigation/types';

type VideoRoute = RouteProp<RootStackParamList, 'VideoCall'>;

const VideoCallScreen: React.FC = () => {
  const route = useRoute<VideoRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const citaId = String(route.params?.citaId || '');
  const initiate = Boolean(route.params?.initiate);

  const access = useAppointmentVideoAccess(citaId);
  const call = useVideoCall(citaId);
  const signaler = useCallSignaler();

  /** Iniciar la llamada cuando el acceso esté disponible */
  useEffect(() => {
    if (!citaId) return;
    if (call.state !== 'idle') return;
    if (!access.canJoin) return;

    call.start();
  }, [citaId, access.canJoin, call.state]);

  /** Salir si access deja de ser válido mientras la llamada está activa */
  useEffect(() => {
    if (!access.canJoin && (call.state === 'connected' || call.state === 'joining')) {
      const t = setTimeout(() => call.end('time_up'), 1500);
      return () => clearTimeout(t);
    }
  }, [access.canJoin, call.state]);

  const handleEnd = useCallback(async () => {
    await call.end();
    if (citaId) signaler.end(citaId).catch(() => undefined);
    navigation.goBack();
  }, [call, citaId, signaler, navigation]);

  // ── Auto-redirect when the OTHER side ends the call ──
  useEffect(() => {
    if (call.state !== 'ended') return;
    if (!initiate) {
      const timer = setTimeout(() => {
        Alert.alert(
          'Consulta Finalizada',
          'La consulta ha finalizado.',
          [
            { text: 'Ver Recetas', onPress: () => navigation.navigate('PacienteRecetasDocumentos' as any) },
            { text: 'Volver', onPress: () => navigation.goBack() },
          ]
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [call.state, initiate, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {call.state === 'connected' && call.jitsiConfig ? (
        <JitsiVideoContainer config={call.jitsiConfig} onEnd={handleEnd} />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#137fec" />
          <Text style={styles.loadingText}>
            {call.state === 'joining' ? 'Conectando con la sala de Jitsi...' : 'Preparando consulta...'}
          </Text>
          <ConnectionStatus state={call.state} />
          
          <TouchableOpacity style={styles.closeBtn} onPress={handleEnd}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {call.error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={20} color="#fff" />
          <Text style={styles.errorTxt}>{call.error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => call.start()}>
            <Text style={styles.retryBtnText}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    right: 20,
    padding: 8,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

export default VideoCallScreen;
