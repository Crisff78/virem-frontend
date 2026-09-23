// Required only inside App's __DEV__ branch; excluded from production bundles.
import React, { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { BACKEND_URL } from '../../config/backend';

export default function PortalPreviewNotice() {
  const [mode, setMode] = useState<'loading' | 'openai' | 'synthetic' | 'unknown'>('loading');
  useEffect(() => {
    let alive = true;
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal, cache: 'no-store' });
        const status = await response.json();
        if (alive && request === controller) setMode(response.ok && status.synthetic === true
          ? status.openai === true ? 'openai' : status.openai === false ? 'synthetic' : 'unknown'
          : 'unknown');
      } catch {
        if (alive && request === controller) setMode('unknown');
      } finally { clearTimeout(timeout); }
    }
    void refresh();
    const interval = setInterval(refresh, 15000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive = false; clearInterval(interval); request?.abort(); subscription.remove(); };
  }, []);
  const label = mode === 'openai' ? 'OpenAI activo · Con consumo'
    : mode === 'synthetic' ? 'Respuestas de demostración · Sin OpenAI'
    : mode === 'loading' ? 'Verificando proveedor…' : 'Proveedor sin verificar';
  return <Text accessibilityLiveRegion="polite" style={{ backgroundColor: '#FFF3CD', color: '#513C00', padding: 8, textAlign: 'center' }}>
    Entorno local · Pacientes de prueba · {label}
  </Text>;
}
