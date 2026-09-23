import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Image, Animated, Easing, Dimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';
import { useResponsive } from './hooks/useResponsive';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EspecialidadDetalle'>;
type Route = RouteProp<RootStackParamList, 'EspecialidadDetalle'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const colors = {
  primary: '#2B6CB0',
  secondary: '#1A365D',
  dark: '#0F172A',
  muted: '#475569',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  accent: '#63B3ED'
};

// --- COMPONENTE: FONDO DINÁMICO ESPACIAL (CONSTANTE Y VARIADO) ---
const ParticleBackground = () => {
  const particles = Array(25).fill(0);
  return (
    <View style={styles.backgroundCanvas}>
      {particles.map((_, i) => <SpatialParticle key={i} index={i} />)}
    </View>
  );
};

const SpatialParticle = ({ index }: { index: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  
  const xPos = useRef(Math.random() * SCREEN_WIDTH).current;
  const yPos = useRef(Math.random() * SCREEN_HEIGHT * 1.5).current;
  
  const size = useRef(35 + Math.random() * 60).current;
  const duration = useRef(15000 + Math.random() * 10000).current;
  const delay = useRef(Math.random() * 8000).current; 
  const color = useRef(index % 2 === 0 ? colors.primary : colors.accent).current;
  
  // Lógica de tamaño personalizada
  // 0: Tamaño normal (fijo) | 1: Se agranda un poco
  const growthType = useRef(Math.random() > 0.7 ? 1 : 0).current;

  useEffect(() => {
    let isMounted = true;
    const startAnimation = () => {
      if (!isMounted) return;
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: duration,
        delay: delay,
        easing: Easing.linear, // Velocidad CONSTANTE de principio a fin
        useNativeDriver: true,
      }).start(() => isMounted && startAnimation());
    };
    startAnimation();
    return () => { isMounted = false; };
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.8, -SCREEN_HEIGHT * 1.2],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 5, -5], // Balanceo casi nulo
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 0.5, 0.5, 0],
  });

  // Animación de escala según el tipo
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: growthType === 1 ? [1, 1.3] : [1, 1], // Unas crecen, otras se quedan igual
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: xPos,
        top: yPos,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    />
  );
};

const EspecialidadDetalleScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { isDesktop, select } = useResponsive();
  
  const params = route.params || {};
  const { title = '', description = '', image = null, icon = 'medical-services', detailedInfo = '', whenToGo = [], importance = '' } = params as any;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const fadeHero = useRef(new Animated.Value(0)).current;
  const fadeContent = useRef(new Animated.Value(0)).current;
  const translateYContent = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeHero, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeContent, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(translateYContent, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
      ])
    ]).start();
  }, []);

  const renderBoldBrand = (text: any) => {
    if (!text || typeof text !== 'string') return <Text>{text || ''}</Text>;
    const parts = text.split(/(VIREM)/g);
    return parts.map((part, i) => 
      part === 'VIREM' 
        ? <Text key={i} style={{ fontWeight: '900', color: colors.secondary }}>{part}</Text> 
        : <Text key={i}>{part}</Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { height: select({ mobile: 70, tablet: 80, desktop: 80 }) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} scrollEventThrottle={16}>
        <ParticleBackground />

        <Animated.View style={[styles.heroContainer, { height: select({ mobile: 220, tablet: 280, desktop: 350 }), opacity: fadeHero }]}>
          {image && (
            <Image 
              source={typeof image === 'string' ? { uri: image } : image} 
              style={[styles.heroImage, title === 'Nutrición' && { transform: [{ translateY: -40 }] }, title === 'Odontología' && { transform: [{ translateY: 40 }] }]} 
              resizeMode="cover" 
            />
          )}
          <View style={styles.imageOverlay} />
          <View style={[styles.titleContainer, { bottom: select({ mobile: 40, tablet: 50, desktop: 60 }), left: select({ mobile: 24, tablet: 60, desktop: 80 }) }]}>
            <View style={[styles.iconBadge, { width: 50, height: 50, marginBottom: 12 }]}>
              <MaterialIcons name={icon} size={28} color="#fff" />
            </View>
            <Text style={[styles.heroTitle, { fontSize: select({ mobile: 28, tablet: 40, desktop: 48 }) }]}>{title}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.contentWrapper, { marginTop: -30, opacity: fadeContent, transform: [{ translateY: translateYContent }] }]}>
          <View style={[styles.infoCard, { padding: select({ mobile: 24, tablet: 40, desktop: 60 }) }]}>
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Sobre esta especialidad</Text>
              <Text style={styles.bodyText}>{renderBoldBrand(description || "Información en proceso...")}</Text>
            </View>

            {detailedInfo ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Información Detallada</Text>
                <Text style={styles.bodyText}>{renderBoldBrand(detailedInfo)}</Text>
              </View>
            ) : null}

            {whenToGo && whenToGo.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Cuándo acudir</Text>
                <View style={styles.whenGrid}>
                  {whenToGo.map((item: string, index: number) => (
                    <View key={index} style={styles.whenItem}>
                      <View style={styles.checkBadge}><MaterialIcons name="check" size={16} color={colors.primary} /></View>
                      <Text style={styles.whenText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {importance ? (
              <View style={[styles.section, styles.importanceBox]}>
                <View style={styles.importanceHeader}>
                  <MaterialIcons name="stars" size={24} color={colors.primary} />
                  <Text style={[styles.sectionHeading, { marginBottom: 0, marginLeft: 10 }]}>Importancia</Text>
                </View>
                <Text style={styles.bodyText}>{renderBoldBrand(importance)}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAuthModal(true)}>
              <Text style={styles.actionBtnText}>AGENDAR CON UN ESPECIALISTA</Text>
              <MaterialIcons name="chevron-right" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {showAuthModal && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBlurClose} activeOpacity={1} onPress={() => setShowAuthModal(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}><MaterialIcons name="account-circle" size={50} color={colors.primary} /></View>
              <Text style={styles.modalTitle}>¡Casi listo!</Text>
              <Text style={styles.modalMessage}>Para agendar con nuestros especialistas, primero crea tu cuenta en <Text style={{ fontWeight: '900', color: colors.secondary }}>VIREM</Text>.</Text>
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => { setShowAuthModal(false); navigation.navigate('SeleccionPerfil'); }}>
                  <Text style={styles.modalBtnTextPrimary}>CREAR MI CUENTA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => { setShowAuthModal(false); navigation.navigate('Login'); }}>
                  <Text style={styles.modalBtnTextSecondary}>YA TENGO CUENTA (INGRESAR)</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.modalCloseLink} onPress={() => setShowAuthModal(false)}>
                <Text style={styles.modalCloseLinkText}>Ahora no, gracias</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingTop: Platform.OS === 'ios' ? 40 : 0, zIndex: 100, elevation: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 16 },
  backText: { color: colors.primary, fontWeight: '700', marginLeft: 4, fontSize: 14 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.dark },
  scrollContent: { paddingBottom: 60, position: 'relative' },
  backgroundCanvas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '100%', zIndex: -1 },
  heroContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  titleContainer: { position: 'absolute', alignItems: 'flex-start' },
  iconBadge: { borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  heroTitle: { fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, letterSpacing: -0.5 },
  contentWrapper: { paddingHorizontal: 20, maxWidth: 1000, alignSelf: 'center', width: '100%', zIndex: 10 },
  infoCard: { backgroundColor: '#fff', borderRadius: 32, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 30, elevation: 10, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.5)' },
  section: { marginBottom: 40 },
  sectionHeading: { fontSize: 22, fontWeight: '900', color: colors.secondary, marginBottom: 16, letterSpacing: -0.5 },
  bodyText: { fontSize: 16, color: colors.dark, lineHeight: 26, fontWeight: '500', opacity: 0.9 },
  whenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  whenItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E1EFFE', minWidth: '45%' },
  checkBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E1EFFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  whenText: { fontSize: 14, fontWeight: '700', color: colors.secondary },
  importanceBox: { backgroundColor: '#F8FAFC', padding: 30, borderRadius: 24, borderLeftWidth: 6, borderLeftColor: colors.primary, marginBottom: 20 },
  importanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20, width: '100%' },
  actionBtn: { backgroundColor: colors.primary, padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8, marginTop: 10 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
  modalBlurClose: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 32, padding: 35, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: colors.secondary, marginBottom: 10 },
  modalMessage: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  modalButtonContainer: { width: '100%', gap: 12 },
  modalBtn: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnPrimary: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  modalBtnSecondary: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E2E8F0' },
  modalBtnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalBtnTextSecondary: { color: colors.secondary, fontSize: 14, fontWeight: '700' },
  modalCloseLink: { marginTop: 20 },
  modalCloseLinkText: { color: colors.muted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }
});

export default EspecialidadDetalleScreen;
