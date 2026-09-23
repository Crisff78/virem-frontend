import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Props = {
  config: {
    domain: string;
    roomName: string;
    displayName: string;
    userId: string;
  };
  onEnd?: () => void;
};

const JitsiVideoContainer: React.FC<Props> = ({ config, onEnd }) => {
  // Jitsi supports passing config and user info via URL fragments (#)
  const joinUrl = `https://${config.domain}/${config.roomName}#userInfo.displayName="${encodeURIComponent(config.displayName)}"&config.prejoinPageEnabled=false`;

  const handlePress = async () => {
    // Try to open with jitsi-meet:// protocol if installed (works for some versions)
    // But web URL is safer as it prompts to open the app or stay in browser
    const supported = await Linking.canOpenURL(joinUrl);
    if (supported) {
      await Linking.openURL(joinUrl);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glassCard}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="videocam" size={48} color="#fff" />
        </View>
        
        <Text style={styles.title}>Consulta Virtual</Text>
        <Text style={styles.subtitle}>
          Tu médico te espera en la sala segura de Jitsi Meet.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>MÉDICO</Text>
          <Text style={styles.infoValue}>{config.displayName}</Text>
        </View>
        
        <TouchableOpacity style={styles.primaryButton} onPress={handlePress}>
          <MaterialIcons name="call" size={24} color="#fff" />
          <Text style={styles.buttonText}>ENTRAR AHORA</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onEnd}>
          <Text style={styles.secondaryButtonText}>FINALIZAR SESIÓN</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        La conexión es cifrada de extremo a extremo.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b18',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#137fec',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#137fec',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a8be',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  infoBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: '#137fec',
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#137fec',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#137fec',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondaryButton: {
    marginTop: 24,
    padding: 10,
  },
  secondaryButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footerText: {
    position: 'absolute',
    bottom: 40,
    color: 'rgba(148, 168, 190, 0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default JitsiVideoContainer;
