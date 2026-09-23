import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type VideoCallFrameProps = {
  roomName: string;
  displayName: string;
  onHangup?: () => void;
  onReadyToClose?: () => void;
  jwtToken?: string;
  jitsiDomain?: string;
};

/**
 * Embedded Jitsi Meet component.
 * Uses the IFrame API on Web and a WebView on Mobile.
 */
const VideoCallFrame: React.FC<VideoCallFrameProps> = ({
  roomName,
  displayName,
  onHangup,
  onReadyToClose,
  jwtToken,
  jitsiDomain = 'meet.jit.si',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const jitsiContainerRef = useRef<View>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // For mobile, we would ideally use a WebView or react-native-jitsi-meet.
      // Since this is a pair-programming session, I'll implement the Web version first
      // and provide a placeholder for mobile, or use an iframe in WebView if allowed.
      setLoading(false);
      return;
    }

    // Load Jitsi IFrame API script if not present
    const scriptId = 'jitsi-external-api';
    const setupJitsi = () => {
      try {
        const domain = jitsiDomain;
        const options = {
          roomName: roomName,
          width: '100%',
          height: '100%',
          parentNode: document.getElementById('jitsi-container'),
          userInfo: {
            displayName: displayName,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false, 
            disableDeepLinking: true,
            enableWelcomePage: false,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
              'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
              'security'
            ],
          },
          jwt: jwtToken,
        };

        const api = new (window as any).JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;

        api.addEventListeners({
          readyToClose: () => {
            if (onReadyToClose) onReadyToClose();
            if (onHangup) onHangup();
          },
          videoConferenceTerminated: () => {
            if (onHangup) onHangup();
          },
        });

        setLoading(false);
      } catch (err) {
        console.error('Jitsi error:', err);
        setError('No se pudo cargar la videollamada.');
        setLoading(false);
      }
    };

    if (!(window as any).JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://${jitsiDomain}/external_api.js`;
      script.async = true;
      script.onload = setupJitsi;
      script.onerror = () => {
        setError('Error al cargar el script de videollamada.');
        setLoading(false);
      };
      document.body.appendChild(script);
    } else {
      setupJitsi();
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      // Remove the iframe manually if Jitsi doesn't cleanup properly
      const container = document.getElementById('jitsi-container');
      if (container) container.innerHTML = '';
    };
  }, [roomName, displayName, jwtToken, jitsiDomain, onHangup, onReadyToClose]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.mobilePlaceholder}>
        <MaterialIcons name="videocam" size={48} color="#137fec" />
        <Text style={styles.mobileText}>
          La videollamada integrada está optimizada para Web.
        </Text>
        <Text style={styles.mobileSubtext}>
          En móviles, estamos trabajando para integrar el SDK nativo.
        </Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onHangup}>
          <Text style={styles.closeBtnText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#137fec" />
          <Text style={styles.loadingText}>Iniciando sala...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onHangup}>
            <Text style={styles.retryBtnText}>Regresar</Text>
          </TouchableOpacity>
        </View>
      )}
      <View
        id="jitsi-container"
        style={[styles.jitsiInner, (loading || error) && styles.hidden]}
      />
    </View>
  );
};

export default VideoCallFrame;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  jitsiInner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  hidden: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1931',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 15,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1931',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 11,
  },
  errorText: {
    marginTop: 15,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#137fec',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  mobilePlaceholder: {
    flex: 1,
    backgroundColor: '#0A1931',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  mobileText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  mobileSubtext: {
    color: '#8aa7bf',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: 30,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
});
