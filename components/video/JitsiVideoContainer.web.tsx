import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

type Props = {
  config: {
    domain: string;
    roomName: string;
    displayName: string;
    userId: string;
  };
  onEnd?: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiVideoContainer: React.FC<Props> = ({ config, onEnd }) => {
  const containerRef = useRef<any>(null);
  const apiRef = useRef<any>(null);
  const onEndRef = useRef(onEnd);

  // Mantener la referencia de onEnd actualizada sin disparar el efecto
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const domain = config.domain || 'meet.jit.si';
    const scriptId = 'jitsi-external-api';
    
    const loadJitsi = () => {
      if (!containerRef.current || apiRef.current) return;
      
      // Limpiar contenedor para evitar duplicados
      containerRef.current.innerHTML = '';
      
      const options = {
        roomName: config.roomName,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        userInfo: {
          displayName: config.displayName,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'e2ee'
          ],
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
      };

      try {
        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
        
        apiRef.current.addEventListener('readyToClose', () => {
          onEndRef.current?.();
        });
        apiRef.current.addEventListener('videoConferenceLeft', () => {
          onEndRef.current?.();
        });
      } catch (err) {
        console.error('[Jitsi] Error creating API:', err);
      }
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://${domain}/external_api.js`;
        script.async = true;
        document.body.appendChild(script);
      }
      script.onload = loadJitsi;
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [config.roomName, config.domain, config.displayName]);

  return (
    <View style={styles.container}>
      <View 
        ref={containerRef as any} 
        style={styles.jitsiContainer} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  jitsiContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

export default JitsiVideoContainer;
