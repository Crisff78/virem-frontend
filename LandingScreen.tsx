import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Image, Animated, Pressable, Easing } from 'react-native';
import { useResponsive } from './hooks/useResponsive';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Landing'>;

const ViremLogo = require('./assets/imagenes/descarga.png');
const EquipoVirem = require('./assets/imagenes/equipo_virem.png');
const HeartImg = require('./assets/imagenes/Heart.png');
const HeartHQImg = require('./assets/imagenes/Heart_HQ.png');
const HTImg = require('./assets/imagenes/HT.png');
const VcImg = require('./assets/imagenes/vc.png');
const SaludMentalImg = require('./assets/imagenes/SaludMental.png');
const ChequeoImg = require('./assets/imagenes/Chequeo.png');

const colors = {
  primary: '#2B6CB0', // Professional, muted blue
  secondary: '#1A365D', // Deep navy blue
  dark: '#0F172A',
  muted: '#475569',
  bg: '#F8FAFC',
  white: '#FFFFFF',
};

const FadeInView = ({ children, delay = 0, style }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 700, useNativeDriver: true })
      ])
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const ShrinkingLine = ({ delay = 0, trigger = true }) => {
  const widthAnim = useRef(new Animated.Value(250)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(widthAnim, {
            toValue: 60,
            duration: 1200,
            easing: Easing.out(Easing.exp),
            useNativeDriver: false
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false
          }),
        ])
      ]).start();
    }
  }, [delay, trigger]);

  return (
    <Animated.View style={{
      width: widthAnim,
      height: 4,
      backgroundColor: colors.primary,
      marginBottom: 16,
      borderRadius: 2,
      opacity
    }} />
  );
};

const MessageBadge = ({ trigger }: { trigger: boolean }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const [showChecks, setShowChecks] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      // Pop in effect
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();

      // After 2 seconds, show the blue checks
      const timer = setTimeout(() => {
        setShowChecks(true);
        Animated.timing(checkAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 40,
      left: -20,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      padding: 16,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 20,
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      minWidth: 220,
      transform: [{ scale }],
      ...(Platform.select({
        web: { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }
      }) || {} as any)
    }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' }}>
        <MaterialIcons name="person-pin" size={26} color={colors.primary} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontWeight: '800', color: colors.dark, fontSize: 13 }}>
          Tu médico, donde estés
        </Text>
        {showChecks && (
          <Animated.View style={{ opacity: checkAnim, flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={{ fontSize: 10, color: colors.muted, marginRight: 4 }}>Visto</Text>
            <MaterialIcons name="done-all" size={16} color="#34B7F1" />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const HoverCard = ({ children, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.02)).current;

  const handleMouseEnter = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.03, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.15, duration: 300, useNativeDriver: false })
    ]).start();
  };

  const handleMouseLeave = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.02, duration: 300, useNativeDriver: false })
    ]).start();
  };

  return (
    <Animated.View
      style={[style, { transform: [{ scale }], shadowOpacity }]}
      {...Platform.select({
        web: { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
      })}
    >
      {children}
    </Animated.View>
  );
};

const HoverButton = ({ children, onPress, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handleMouseEnter = () => {
    Animated.spring(scale, { toValue: 1.05, friction: 3, tension: 40, useNativeDriver: false }).start();
  };

  const handleMouseLeave = () => {
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: false }).start();
  };

  return (
    <Animated.View
      style={[{ transform: [{ scale }] }]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}
        {...Platform.select({
          web: { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
        } as any)}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const AnimatedGradientBg = ({ children, style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const bgColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#EBF5FB', '#E1EFF9', '#D6E8F4'],
  });

  if (Platform.OS === 'web') {
    const overlayOpacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    });

    return (
      <Animated.View style={[style, { backgroundColor: bgColor, overflow: 'hidden' }]}>
        {/* Orb decorativo 1 */}
        <Animated.View style={{
          position: 'absolute', top: -80, right: -80,
          width: 350, height: 350, borderRadius: 175,
          backgroundColor: 'rgba(43, 108, 176, 0.08)',
          opacity: overlayOpacity,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
        }} />
        {/* Orb decorativo 2 */}
        <Animated.View style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 280, height: 280, borderRadius: 140,
          backgroundColor: 'rgba(26, 54, 93, 0.06)',
          opacity: overlayOpacity,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) }],
        }} />
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[style, { backgroundColor: bgColor }]}>
      {children}
    </Animated.View>
  );
};

const FloatingPhone = ({ children }: any) => {
  if (Platform.OS === 'web') {
    // Inject CSS keyframes once
    useEffect(() => {
      if (typeof document !== 'undefined' && !document.getElementById('floatingPhoneCSS')) {
        const style = document.createElement('style');
        style.id = 'floatingPhoneCSS';
        style.textContent = `
          @keyframes floatPhone {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-14px); }
          }
          .floating-phone {
            animation: floatPhone 3s ease-in-out infinite;
            will-change: transform;
          }
        `;
        document.head.appendChild(style);
      }
    }, []);

    const divRef = useRef<any>(null);
    useEffect(() => {
      if (divRef.current) {
        // react-native-web renders Views as divs, access the underlying DOM node
        const node = divRef.current;
        if (node && node.classList) {
          node.classList.add('floating-phone');
        }
      }
    });

    return (
      <View ref={divRef}>
        {children}
      </View>
    );
  }

  // Native fallback
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -14, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
      {children}
    </Animated.View>
  );
};

const HoverCountCard = ({ children, count, style }: { children: any; count: string; style?: any }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOp = useRef(new Animated.Value(0.02)).current;
  const [hovered, setHovered] = useState(false);
  const [displayNum, setDisplayNum] = useState(0);
  const intervalRef = useRef<any>(null);

  // Extract the number from count string like "6 médico(s) disponible(s)"
  const numericMatch = count.match(/\d+/);
  const targetNum = numericMatch ? parseInt(numericMatch[0], 10) : 0;
  const hasNumber = !!numericMatch;

  const handleMouseEnter = () => {
    setHovered(true);
    setDisplayNum(0);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.03, duration: 200, useNativeDriver: false }),
      Animated.timing(shadowOp, { toValue: 0.15, duration: 200, useNativeDriver: false }),
    ]).start();

    if (hasNumber && targetNum > 0) {
      let current = 0;
      const step = Math.max(1, Math.floor(targetNum / 15));
      const speed = Math.max(30, 400 / targetNum);
      intervalRef.current = setInterval(() => {
        current += step;
        if (current >= targetNum) {
          current = targetNum;
          clearInterval(intervalRef.current);
        }
        setDisplayNum(current);
      }, speed);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setDisplayNum(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(shadowOp, { toValue: 0.02, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const countLabel = hasNumber
    ? count.replace(/\d+/, String(displayNum))
    : count;

  return (
    <Animated.View
      style={[style, { transform: [{ scale }], shadowOpacity: shadowOp }]}
      {...Platform.select({
        web: { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
      } as any)}
    >
      {children}
      {hovered && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary, textAlign: 'center', marginTop: 10 }}>
          {countLabel}
        </Text>
      )}
    </Animated.View>
  );
};

const HoverServiceCard = ({ title, description, image, style }: any) => {
  const { isMobile, select } = useResponsive();
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.15)).current;
  const overlayY = useRef(new Animated.Value(260)).current; // Start well below the bottom
  const [toggled, setToggled] = useState(false);

  const showOverlay = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.05, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.3, duration: 300, useNativeDriver: false }),
      Animated.spring(overlayY, { toValue: 0, tension: 50, friction: 7, useNativeDriver: false }),
    ]).start();
  };

  const hideOverlay = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.15, duration: 300, useNativeDriver: false }),
      Animated.spring(overlayY, { toValue: 260, tension: 50, friction: 7, useNativeDriver: false }),
    ]).start();
  };

  const handlePress = () => {
    if (isMobile || Platform.OS !== 'web') {
      if (toggled) {
        hideOverlay();
      } else {
        showOverlay();
      }
      setToggled(!toggled);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile && Platform.OS === 'web') {
      showOverlay();
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && Platform.OS === 'web') {
      hideOverlay();
    }
  };

  return (
    <Animated.View
      style={[style, { transform: [{ scale }], shadowOpacity }]}
      {...Platform.select({
        web: { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
      } as any)}
    >
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        <View style={{ backgroundColor: colors.primary, paddingVertical: 16, alignItems: 'center', zIndex: 2 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{title}</Text>
        </View>
        <View style={{ position: 'relative', overflow: 'hidden' }}>
          <Image 
            source={image} 
            style={{ 
              width: '100%', 
              height: select({ mobile: 220, tablet: 240, desktop: 260 }),
              resizeMode: 'cover' 
            }} 
          />

          {/* Overlay Concept - Slides up on hover/tap */}
          <Animated.View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0, // Cover the whole image area for better readability
            backgroundColor: 'rgba(26, 54, 93, 0.95)',
            padding: 24,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ translateY: overlayY }],
            ...(Platform.select({ web: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } }) || {} as any)
          }}>
            <Text style={{ color: '#fff', fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '500' }}>
              {description}
            </Text>
            {(isMobile || toggled) && (
              <View style={{ marginTop: 20, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                  {toggled ? 'Toca para cerrar' : 'Ver menos'}
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const HoverSpecialtyCard = ({ icon, title, context, image, detailedInfo, whenToGo, importance, style }: any) => {
  const navigation = useNavigation<Nav>();
  const scale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayTranslateY = useRef(new Animated.Value(20)).current;

  const handleMouseEnter = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.05, duration: 300, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(overlayTranslateY, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const handleMouseLeave = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(overlayTranslateY, { toValue: 20, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  return (
    <Animated.View
      style={[style, { transform: [{ scale }] }]}
      {...Platform.select({
        web: { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
      } as any)}
    >
      <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#F0F7FA", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
        <MaterialIcons name={icon} size={32} color={colors.secondary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "900", color: colors.dark, textAlign: "center" }}>{title}</Text>

      {/* Context Overlay */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(26, 54, 93, 0.95)',
        borderRadius: 20,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: overlayOpacity,
        transform: [{ translateY: overlayTranslateY }],
        ...(Platform.select({ web: { backdropFilter: 'blur(4px)' } }) || {} as any)
      }}>
        <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', lineHeight: 20, fontWeight: '500' }}>
          {context}
        </Text>
        <TouchableOpacity
          style={{ marginTop: 12, borderBottomWidth: 1, borderBottomColor: '#fff' }}
          onPress={() => (navigation as any).navigate('EspecialidadDetalle', {
            title,
            description: context,
            icon,
            image,
            detailedInfo,
            whenToGo,
            importance
          })}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>SABER MÁS</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const HoverBlogCard = ({ category, title, description, image, onPress, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.1)).current;
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.02, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.25, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const handleMouseLeave = () => {
    setHovered(false);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(shadowOpacity, { toValue: 0.1, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  if (Platform.OS === 'web') {
    useEffect(() => {
      if (typeof document !== 'undefined' && !document.getElementById('blogCardCSS')) {
        const style = document.createElement('style');
        style.id = 'blogCardCSS';
        style.textContent = `
          .blog-card-img {
            transition: transform 0.6s cubic-bezier(0.33, 1, 0.68, 1);
          }
          .blog-card-hovered .blog-card-img {
            transform: scale(1.1);
          }
        `;
        document.head.appendChild(style);
      }
    }, []);
  }

  return (
    <Animated.View
      style={[style, { transform: [{ scale }], shadowOpacity, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' }]}
      {...Platform.select({
        web: {
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
          className: hovered ? 'blog-card-hovered' : ''
        }
      } as any)}
    >
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        <View style={{ height: 240, overflow: 'hidden' }}>
          <Image
            source={typeof image === 'string' ? { uri: image } : image}
            style={[{ width: '100%', height: '100%' }, Platform.OS === 'web' && { className: 'blog-card-img' } as any]}
            resizeMode="cover"
          />
          <View style={{
            position: 'absolute',
            top: 20,
            left: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            ...(Platform.select({ web: { backdropFilter: 'blur(4px)' } }) || {} as any)
          }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{category}</Text>
          </View>
        </View>

        <View style={{ padding: 30 }}>
          <Text style={{ color: colors.dark, fontSize: 22, fontWeight: '800', marginBottom: 12, lineHeight: 28 }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 24, marginBottom: 20 }}>{description}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Leer más</Text>
            <Animated.View style={{ transform: [{ translateX: hovered ? 5 : 0 }] }}>
              <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
            </Animated.View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const LandingScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [layoutY, setLayoutY] = useState({ plataforma: 0, especialidades: 0, nosotros: 0, blog: 0, contacto: 0 });

  const scrollTo = (y: number) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };
  const { isDesktop, isTablet, isMobile, select, width, height } = useResponsive();

  const navigateToLogin = () => navigation.navigate('Login');
  const navigateToRegister = () => navigation.navigate('SeleccionPerfil');

  const [navScrolled, setNavScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const [nosotrosVisible, setNosotrosVisible] = useState(false);

  const toggleMenu = () => {
    if (isMenuOpen) {
      Animated.timing(menuAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setIsMenuOpen(false));
    } else {
      setIsMenuOpen(true);
      Animated.timing(menuAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setIsMenuOpen(false));
  };

  // Inject sticky navbar CSS once
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('stickyNavCSS')) {
      const style = document.createElement('style');
      style.id = 'stickyNavCSS';
      style.textContent = `
        .nav-sticky {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-scrolled {
          background-color: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const navRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS === 'web' && navRef.current) {
      const node = navRef.current;
      if (node && node.classList) {
        node.classList.add('nav-sticky');
        if (navScrolled) {
          node.classList.add('nav-scrolled');
        } else {
          node.classList.remove('nav-scrolled');
        }
      }
    }
  }, [navScrolled]);

  return (
    <View style={styles.container}>
      {/* TOP NAVBAR - STICKY WITH BLUR */}
      <View ref={navRef} style={[
        styles.navbar,
        isDesktop && styles.navbarDesktop,
        navScrolled && { paddingVertical: 10 },
        isMobile && { paddingHorizontal: 12 }
      ]}>
        <View style={styles.navLeft}>
          <Image source={ViremLogo} style={[styles.logoImage, isMobile && { width: 24, height: 24 }]} resizeMode="contain" />
          <Text style={[styles.logoText, isMobile && { fontSize: 20 }]}>VIREM</Text>
        </View>

        {isDesktop ? (
          <>
            <View style={styles.navLinksCenter}>
              <TouchableOpacity onPress={() => scrollTo(layoutY.plataforma)}>
                <Text style={styles.navLinkCenterText}>Plataforma</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollTo(layoutY.especialidades)}>
                <Text style={styles.navLinkCenterText}>Especialidades</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollTo(layoutY.nosotros)}>
                <Text style={styles.navLinkCenterText}>Nosotros</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollTo(layoutY.blog)}>
                <Text style={styles.navLinkCenterText}>Blog</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollTo(layoutY.contacto)}>
                <Text style={styles.navLinkCenterText}>Contacto</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navRight}>
              <HoverButton style={[styles.navBtn, { backgroundColor: colors.primary, marginRight: 10 }]} onPress={navigateToRegister}>
                <Text style={styles.navBtnText}>REGISTRARSE</Text>
              </HoverButton>
              <HoverButton style={[styles.navBtn, { backgroundColor: colors.primary }]} onPress={navigateToLogin}>
                <Text style={styles.navBtnText}>INICIAR SESIÓN</Text>
              </HoverButton>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={toggleMenu} style={{ padding: 8 }}>
            <MaterialIcons name={isMenuOpen ? "close" : "menu"} size={30} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* MOBILE MENU OVERLAY (Inspired by reference) */}
      {isMenuOpen && !isDesktop && (
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: height,
          backgroundColor: '#FFFFFF',
          zIndex: 1000,
          opacity: menuAnim,
          transform: [{
            translateX: menuAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [width, 0]
            })
          }]
        }}>
          {/* Header inside Menu */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingHorizontal: 20, 
            paddingTop: Platform.OS === 'ios' ? 50 : 20, 
            paddingBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: '#F1F5F9'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={ViremLogo} style={{ width: 38, height: 38 }} resizeMode="contain" />
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.secondary, letterSpacing: -0.5 }}>VIREM</Text>
            </View>
            <TouchableOpacity onPress={closeMenu} style={{ padding: 10 }}>
              <MaterialIcons name="close" size={32} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            {/* Action Buttons Grid - Top Priority */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 30 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                onPress={() => { navigateToRegister(); closeMenu(); }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>REGÍSTRATE</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: colors.secondary, paddingVertical: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                onPress={() => { navigateToLogin(); closeMenu(); }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>INICIAR SESIÓN</Text>
              </TouchableOpacity>
            </View>

            {/* Navigation Links - Clean List without icons */}
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 4, overflow: 'hidden' }}>
              {[
                { label: 'Especialidades', y: layoutY.especialidades },
                { label: 'Plataforma', y: layoutY.plataforma },
                { label: 'Nosotros', y: layoutY.nosotros },
                { label: 'Blog', y: layoutY.blog },
                { label: 'Contacto', y: layoutY.contacto },
              ].map((link, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  onPress={() => { scrollTo(link.y); closeMenu(); }}
                  style={{ 
                    paddingVertical: 20, 
                    paddingHorizontal: 20, 
                    borderBottomWidth: idx === 4 ? 0 : 1, 
                    borderBottomColor: '#E2E8F0' 
                  }}
                >
                  <Text style={{ fontSize: 18, color: colors.secondary, fontWeight: '500', letterSpacing: -0.5 }}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      )}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        onScroll={(event: any) => {
          const y = event.nativeEvent.contentOffset.y;
          const isScrollingUp = y < lastScrollY.current;

          scrollY.setValue(y);
          setNavScrolled(y > 50);

          lastScrollY.current = y;

          if (!nosotrosVisible && y > layoutY.nosotros - 800) {
            setNosotrosVisible(true);
          }
        }}
        scrollEventThrottle={16}
      >

        {/* HERO SECTION */}
        <AnimatedGradientBg style={[styles.heroSection, isDesktop && styles.heroDesktop, !isDesktop && { paddingVertical: 60, paddingHorizontal: 20 }]}>

          {/* Text on the Left */}
          <View style={[styles.heroTextContainer, isDesktop && styles.heroTextDesktop, !isDesktop && { maxWidth: '100%', alignItems: 'center' }]}>
            <FadeInView delay={100}>
              <Text style={[
                styles.heroTitle,
                {
                  fontSize: select({ mobile: 28, tablet: 48, desktop: 56 }),
                  lineHeight: select({ mobile: 36, tablet: 56, desktop: 64 }),
                  textAlign: isDesktop ? 'left' : 'center'
                }
              ]}>
                ¡TU SALUD ES NUESTRA <Text style={{ color: colors.primary }}>PRIORIDAD</Text>!
              </Text>
            </FadeInView>
            <FadeInView delay={300}>
              <Text style={[
                styles.heroSubtitle,
                {
                  fontSize: select({ mobile: 15, tablet: 18, desktop: 18 }),
                  textAlign: isDesktop ? 'left' : 'center'
                }
              ]}>
                Somos líderes en atención primaria en salud. Nos enfocamos en prestar un servicio de salud integral destinado a proteger tu salud y bienestar, desde la comodidad de tu hogar.
              </Text>
            </FadeInView>
            <FadeInView delay={500} style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: isDesktop ? 'flex-start' : 'center' }}>
              <HoverButton style={styles.heroActionBtn} onPress={navigateToRegister}>
                <Text style={styles.heroActionBtnText}>AGENDAR UNA CITA</Text>
              </HoverButton>
            </FadeInView>
          </View>

          {/* Image on the Right */}
          <FadeInView delay={400} style={[styles.heroImageContainer, isDesktop ? { position: 'absolute' } : { position: 'relative', width: '100%', marginTop: 40, alignItems: 'center' }]}>
            <Animated.View style={[styles.heroImage, {
              width: select({ mobile: '100%', tablet: '90%', desktop: 750 }),
              height: select({ mobile: 300, tablet: 550, desktop: 650 }),
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transform: [{
                translateY: scrollY.interpolate({
                  inputRange: [0, 500],
                  outputRange: [0, 80],
                  extrapolate: 'clamp'
                })
              }, { translateX: isDesktop ? 100 : 0 }]
            } as any]}>
              <Image
                source={HeartImg}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </Animated.View>
          </FadeInView>

        </AnimatedGradientBg>

        {/* HOW IT WORKS */}
        <View 
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLayoutY(prev => ({ ...prev, plataforma: y }));
          }} 
          style={[styles.howItWorksSection, isDesktop && styles.howItWorksDesktop]}
        >
          {isDesktop && (
            <View style={[styles.howItWorksImgContainer, { paddingRight: 40 }]}>
              <View style={{ position: 'relative' }}>
                {/* Decorative background shapes */}
                <View style={{ position: 'absolute', top: -20, left: -20, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(43, 108, 176, 0.1)' }} />
                <View style={{ position: 'absolute', bottom: -30, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(26, 54, 93, 0.05)' }} />

                {/* Main image */}
                <Image
                  source={VcImg}
                  style={{ width: 400, height: 460, borderRadius: 30, borderWidth: 6, borderColor: '#fff' }}
                  resizeMode="cover"
                />
                <View style={{ position: 'absolute', top: 0, left: 0, width: 400, height: 460, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15, pointerEvents: 'none' }} />

                {/* Floating info card with Glassmorphism */}
                <View style={{
                  position: 'absolute',
                  bottom: 40,
                  left: -40,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  padding: 16,
                  borderRadius: 20,
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 20,
                  elevation: 20,
                  zIndex: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  minWidth: 200,
                  ...(Platform.select({
                    web: { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }
                  }) || {} as any)
                }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialIcons name="videocam" size={26} color="#2B6CB0" />
                  </View>
                  <View>
                    <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 15 }}>Atención 24/7</Text>
                    <Text style={{ color: '#475569', fontSize: 12 }}>Sin salir de casa</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          <View style={[styles.howItWorksTextContainer, isDesktop && styles.howItWorksTextDesktop]}>
            <Text style={styles.sectionHeadingLeft}>¿CÓMO FUNCIONA VIREM?</Text>
            <Text style={styles.sectionBodyLeft}>
              En VIREM, te acompañamos en un proceso integral de prevención y control de tu salud, ofreciéndote seguimiento personalizado y brindándote las mejores recomendaciones y cuidados médicos.
            </Text>
            <Text style={styles.sectionBodyLeft}>
              Reconocemos que tu bienestar es primordial, por eso nuestro enfoque se centra en prevenir y detectar posibles complicaciones a tiempo de forma virtual, evitando así que se conviertan en problemas más serios.
            </Text>

          </View>
        </View>

        {/* NUEVA SECCIÓN: SERVICIOS (3 Tarjetas) */}
        <View style={{ paddingVertical: select({ mobile: 60, tablet: 80, desktop: 100 }), alignItems: 'center', backgroundColor: '#F0F9FF', width: '100%' }}>
          <FadeInView delay={100} style={{ alignItems: 'center', marginBottom: select({ mobile: 30, tablet: 40, desktop: 50 }) }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.primary, borderRadius: 2, marginBottom: 16 }} />
            <Text style={{ fontSize: select({ mobile: 28, tablet: 32, desktop: 36 }), fontWeight: '900', color: colors.secondary, marginBottom: 16, textAlign: 'center' }}>SERVICIOS</Text>
            <Text style={{ fontSize: 16, color: colors.muted, textAlign: 'center', maxWidth: 800, paddingHorizontal: 20, lineHeight: 24 }}>
              Desde consultas virtuales con especialistas hasta la descarga inmediata de tus recetas médicas, en VIREM contamos con todas las herramientas necesarias para brindarte una atención integral y precisa.
            </Text>
          </FadeInView>

          <View style={{
            flexDirection: select({ mobile: 'column', tablet: 'row', desktop: 'row' }),
            gap: select({ mobile: 24, tablet: 24, desktop: 32 }),
            maxWidth: 1200,
            paddingHorizontal: select({ mobile: 20, tablet: 30, desktop: 40 }),
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%'
          }}>

            <HoverServiceCard
              title="Consultas Virtuales"
              description="Atención médica especializada por videollamada segura, estés donde estés. Habla con tu médico sin salir de casa."
              image={require('./assets/imagenes/Videoconsulta.png')}
              style={{ width: select({ mobile: '100%', tablet: '48%', desktop: 350 }), backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowRadius: 20, elevation: 8 }}
            />

            <HoverServiceCard
              title="Recetas Digitales"
              description="Recibe tus prescripciones médicas oficiales directamente en tu perfil al instante. Descárgalas en cualquier momento."
              image={require('./assets/imagenes/RecetasM.png')}
              style={{ width: select({ mobile: '100%', tablet: '48%', desktop: 350 }), backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowRadius: 20, elevation: 8 }}
            />

            <HoverServiceCard
              title="Historial Clínico"
              description="Accede a tus reportes, estudios y antecedentes médicos de forma segura y organizada. Tu salud siempre a mano."
              image={require('./assets/imagenes/HistorialC.png')}
              style={{ width: select({ mobile: '100%', tablet: '48%', desktop: 350 }), backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowRadius: 20, elevation: 8 }}
            />

          </View>
        </View>

        {/* ESPECIALIDADES GRID */}
        <View 
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLayoutY(prev => ({ ...prev, especialidades: y }));
          }} 
          style={[styles.servicesSection, { backgroundColor: "#FFFFFF", paddingVertical: 80, alignItems: "center", width: "100%", borderTopWidth: 1, borderTopColor: "#E2E8F0" }]}
        >

          <View style={{ width: "100%", maxWidth: 1200, marginBottom: 40, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: colors.dark, marginBottom: 16, textAlign: isDesktop ? "left" : "center" }}>Especialidades Médicas</Text>
            <Text style={{ fontSize: 18, color: colors.muted, lineHeight: 28, maxWidth: 700, textAlign: isDesktop ? "left" : "center" }}>
              Nuestra plataforma conecta a pacientes con especialistas de primer nivel en diversas áreas de la medicina. Selecciona una categoría para ver a los profesionales disponibles.
            </Text>
          </View>

          <View style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: select({ mobile: 16, tablet: 20, desktop: 24 }),
            maxWidth: 1200,
            paddingHorizontal: select({ mobile: 16, tablet: 24, desktop: 40 })
          }}>
            {[
              {
                icon: "medical-services",
                title: "Medicina General",
                context: "La medicina general es la especialidad encargada de brindar atención médica primaria, enfocándose en la prevención, diagnóstico inicial y tratamiento de enfermedades comunes en pacientes de todas las edades.",
                detailedInfo: "La medicina general ofrece atención integral para evaluar síntomas comunes, realizar chequeos médicos y orientar al paciente sobre su estado de salud. El médico general puede diagnosticar enfermedades frecuentes, controlar condiciones básicas y referir al paciente a otras especialidades si es necesario. Esta especialidad es fundamental para mantener un seguimiento preventivo y detectar problemas de salud a tiempo.",
                whenToGo: ["Malestar general persistente", "Fiebre frecuente", "Dolores corporales", "Síntomas nuevos o desconocidos", "Chequeos médicos preventivos"],
                importance: "La medicina general es esencial porque representa el primer nivel de atención médica. Permite detectar enfermedades de forma temprana, prevenir complicaciones y brindar orientación profesional para mantener una buena salud física y bienestar general.",
                img: require('./assets/imagenes/MedicinaGeneral.png')
              },
              {
                icon: "psychology",
                title: "Psicología",
                context: "Acompañamiento profesional para tu salud mental, manejo de estrés y bienestar emocional.",
                detailedInfo: "La psicología clínica en VIREM ofrece un espacio seguro para el abordaje de trastornos emocionales, del estado de ánimo y del comportamiento. Nuestros profesionales utilizan herramientas terapéuticas basadas en evidencia para ayudarte a procesar situaciones de duelo, mejorar tu inteligencia emocional y fortalecer tu resiliencia ante los desafíos cotidianos de la vida personal y laboral.",
                whenToGo: ["Ansiedad o estrés persistente", "Dificultad para manejar emociones", "Problemas en relaciones interpersonales", "Duelos o pérdidas difíciles", "Deseo de autoconocimiento y crecimiento"],
                importance: "Cuidar la mente es tan vital como el cuerpo; un bienestar emocional sólido mejora la calidad de vida, la productividad y la salud física general.",
                img: require('./assets/imagenes/Psicologia.png')
              },
              {
                icon: "favorite-border",
                title: "Cardiología",
                context: "Especialistas en el cuidado del corazón y prevención de enfermedades cardiovasculares.",
                detailedInfo: "Nuestra área de cardiología se centra en la prevención, diagnóstico y tratamiento de patologías del corazón y del sistema circulatorio. Brindamos seguimiento especializado para la hipertensión arterial, arritmias y prevención de infartos, utilizando la telemedicina para monitorear factores de riesgo y ajustar tratamientos de forma oportuna y precisa.",
                whenToGo: ["Dolor o presión en el pecho", "Palpitaciones o ritmo cardíaco irregular", "Fatiga extrema al realizar esfuerzo", "Antecedentes familiares de cardiopatías", "Control de presión arterial elevada"],
                importance: "Las enfermedades cardiovasculares son la principal causa de riesgo global; su detección temprana es la herramienta más poderosa para salvar vidas.",
                img: require('./assets/imagenes/Cardiologia.png')
              },
              {
                icon: "face",
                title: "Dermatología",
                context: "Diagnóstico y tratamiento para afecciones de la piel, cabello y uñas.",
                detailedInfo: "La dermatología en nuestra plataforma abarca desde el tratamiento del acné y dermatitis hasta el monitoreo de lesiones cutáneas sospechosas. Los especialistas evalúan la salud de la piel, el cabello y las uñas bajo un enfoque clínico integral, proporcionando regímenes de cuidado personalizados para mantener la barrera cutánea sana y detectar afecciones de forma precoz.",
                whenToGo: ["Cambios en forma o color de lunares", "Erupciones cutáneas persistentes", "Pérdida inusual de cabello", "Acné que no responde a cuidados básicos", "Piel extremadamente seca o irritada"],
                importance: "La piel es el órgano más extenso y nuestra primera línea de defensa; su salud refleja directamente el bienestar interno de nuestro organismo.",
                img: require('./assets/imagenes/Dermatologia.png')
              },
              {
                icon: "medication",
                title: "Endocrinología",
                context: "Control de hormonas, diabetes, tiroides y trastornos metabólicos.",
                detailedInfo: "Nuestros endocrinólogos se especializan en el complejo sistema hormonal que regula el metabolismo, el crecimiento y la reproducción. Ofrecemos un manejo experto de la diabetes, trastornos de la tiroides, desajustes hormonales y problemas metabólicos, enfocándonos en restaurar el equilibrio químico del cuerpo para optimizar tu energía y salud general.",
                whenToGo: ["Niveles de azúcar elevados (Diabetes)", "Problemas de tiroides conocidos", "Cambios bruscos de peso sin causa clara", "Fatiga crónica o falta de energía", "Desajustes hormonales o metabólicos"],
                importance: "El equilibrio hormonal es el regulador silencioso de casi todas las funciones vitales; su control adecuado previene enfermedades crónicas graves.",
                img: require('./assets/imagenes/Endocrinologia.png')
              },
              {
                icon: "pregnant-woman",
                title: "Ginecología",
                context: "Salud integral para la mujer en todas sus etapas y cuidado reproductivo.",
                detailedInfo: "La ginecología ofrece una atención sensible y profesional para la salud reproductiva femenina en todas las etapas de la vida. Desde la adolescencia hasta la menopausia, nuestros especialistas brindan orientación en anticoncepción, manejo de trastornos menstruales y prevención de patologías mediante chequeos periódicos, asegurando un acompañamiento integral y preventivo.",
                whenToGo: ["Chequeo ginecológico preventivo anual", "Irregularidades en el ciclo menstrual", "Deseo de asesoría anticonceptiva", "Síntomas relacionados con la menopausia", "Molestias pélvicas o infecciones"],
                importance: "La prevención y el control ginecológico periódico son fundamentales para la detección temprana de enfermedades y el empoderamiento de la salud femenina.",
                img: require('./assets/imagenes/Ginecologia.png')
              },
            ].map((esp, i) => (
              <TouchableOpacity
                key={i}
                style={{ width: select({ mobile: "100%", tablet: "45%", desktop: 350 }) }}
                onPress={() => navigation.navigate('EspecialidadDetalle', {
                  title: esp.title,
                  description: esp.context,
                  icon: esp.icon,
                  image: esp.img,
                  detailedInfo: esp.detailedInfo,
                  whenToGo: esp.whenToGo,
                  importance: esp.importance
                })}
              >
                <HoverSpecialtyCard
                  icon={esp.icon}
                  title={esp.title}
                  context={esp.context}
                  image={esp.img}
                  detailedInfo={esp.detailedInfo}
                  whenToGo={esp.whenToGo}
                  importance={esp.importance}
                  style={{ width: "100%", backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 30, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, elevation: 1, height: 200, overflow: 'hidden' }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <HoverButton
            onPress={() => navigation.navigate('Especialidades')}
            style={{
              marginTop: 50,
              backgroundColor: colors.primary,
              paddingHorizontal: 40,
              paddingVertical: 20,
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 8
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 10 }}>
              VER TODAS LAS ESPECIALIDADES
            </Text>
            <MaterialIcons name="chevron-right" size={24} color="#fff" />
          </HoverButton>
        </View>

        {/* NUEVA SECCIÓN: ACCESO EN LÍNEA */}
        <View style={{
          flexDirection: select({ mobile: 'column', tablet: 'column', desktop: 'row' }),
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 80,
          backgroundColor: '#F8FAFC',
          paddingHorizontal: 20,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0'
        }}>

          <View style={{
            flex: select({ mobile: 1, tablet: 1, desktop: 0.4 }),
            alignItems: 'center',
            marginBottom: select({ mobile: 40, tablet: 60, desktop: 0 })
          }}>
            {/* Phone/App Graphic representation - Floating animation */}
            <FloatingPhone>
              <View style={{
                width: 220,
                height: 380,
                backgroundColor: colors.primary,
                borderRadius: 30,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: colors.primary,
                shadowOpacity: 0.4,
                shadowRadius: 30,
                elevation: 10,
                borderWidth: 10,
                borderColor: '#EBF5FB'
              }}>
                <MaterialIcons name="fact-check" size={80} color="#fff" style={{ marginBottom: 20 }} />
                <View style={{ width: 140, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6, marginBottom: 15 }} />
                <View style={{ width: 160, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6, marginBottom: 15 }} />
                <View style={{ width: 120, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6, marginBottom: 40 }} />
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name="check" size={30} color="#fff" />
                </View>
              </View>
            </FloatingPhone>
          </View>

          <View style={{
            flex: select({ mobile: 1, tablet: 1, desktop: 0.5 }),
            paddingLeft: select({ mobile: 0, tablet: 0, desktop: 60 }),
            alignItems: select({ mobile: 'center', tablet: 'center', desktop: 'flex-start' })
          }}>
            <Text style={{
              fontSize: select({ mobile: 28, tablet: 32, desktop: 32 }),
              fontWeight: '300',
              color: colors.secondary,
              marginBottom: 20,
              textAlign: select({ mobile: 'center', tablet: 'center', desktop: 'left' })
            }}>
              GESTIONA TU SALUD EN LÍNEA
            </Text>
            <Text style={{
              fontSize: 16,
              color: colors.muted,
              lineHeight: 28,
              marginBottom: 30,
              textAlign: select({ mobile: 'center', tablet: 'center', desktop: 'left' })
            }}>
              Accede y descarga tus recetas médicas de forma rápida y segura desde cualquier lugar con nuestra plataforma en línea. También podrás visualizar tu historial completo y el seguimiento de tus especialistas.
            </Text>
            <HoverButton style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 8 }} onPress={navigateToLogin}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>INGRESAR A LA PLATAFORMA</Text>
            </HoverButton>
          </View>

        </View>

        {/* NOSOTROS - ENHANCED */}
        <View 
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLayoutY(prev => ({ ...prev, nosotros: y }));
          }} 
          style={[styles.howItWorksSection, { backgroundColor: '#FFFFFF', paddingVertical: 100, borderTopWidth: 1, borderTopColor: '#E2E8F0' }, isDesktop && styles.howItWorksDesktop]}
        >
          <View style={[styles.howItWorksTextContainer, isDesktop && { paddingRight: 60 }, (isTablet || isMobile) && { alignItems: 'center' }]}>

            <FadeInView delay={200}>
              <ShrinkingLine delay={200} trigger={nosotrosVisible} />
              <Text style={[styles.sectionHeadingLeft, (isTablet || isMobile) && { textAlign: 'center' }]}>SOBRE NOSOTROS</Text>
              <Text style={[styles.sectionBodyLeft, (isTablet || isMobile) && { textAlign: 'center' }, { fontSize: 17, color: colors.dark, fontWeight: '500' }]}>
                VIREM nace con la misión de democratizar y facilitar el acceso a la salud. Somos un equipo interdisciplinario que une la medicina y la tecnología para romper las barreras geográficas.
              </Text>
              <Text style={[styles.sectionBodyLeft, (isTablet || isMobile) && { textAlign: 'center' }]}>
                Creemos firmemente en el cuidado continuo del paciente, promoviendo espacios donde puedas encontrar desde médicos generales hasta terapeutas que guíen tu bienestar emocional.
              </Text>

              {/* STATS CARDS */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 30, flexWrap: 'wrap', justifyContent: (isTablet || isMobile) ? 'center' : 'flex-start' }}>
                <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, minWidth: 120, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                  <MaterialIcons name="timer-off" size={24} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.dark, marginTop: 4 }}>Sin Filas</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Atención Directa</Text>
                </View>
                <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, minWidth: 120, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                  <MaterialIcons name="schedule" size={24} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.dark, marginTop: 4 }}>24/7</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Atención</Text>
                </View>
                <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, minWidth: 120, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                  <MaterialIcons name="public" size={24} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.dark, marginTop: 4 }}>100%</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Virtual</Text>
                </View>
              </View>
            </FadeInView>
          </View>

          {isDesktop && (
            <FadeInView delay={400} style={styles.howItWorksImgContainer}>
              <View style={{ position: 'relative', width: 400, height: 400, justifyContent: 'center', alignItems: 'center' }}>
                {/* Single Image with Deep Shadow */}
                <View style={{
                  width: 360,
                  height: 380,
                  borderRadius: 30,
                  backgroundColor: '#fff',
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 30,
                  elevation: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)'
                }}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=600&auto=format&fit=crop' }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>

                {/* Floating highlight badge - SAME STYLE AS ATENCION 24/7 */}
                <MessageBadge trigger={nosotrosVisible} />
              </View>
            </FadeInView>
          )}
        </View>

        {/* BLOG */}
        <View 
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLayoutY(prev => ({ ...prev, blog: y }));
          }} 
          style={[styles.servicesSection, { backgroundColor: '#F0F9FF', paddingVertical: 100, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}
        >
          <FadeInView delay={100} style={{ alignItems: 'center', marginBottom: 60 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.primary, borderRadius: 2, marginBottom: 16 }} />
            <Text style={[styles.sectionHeadingCenter, { fontSize: 36, fontWeight: '900', color: colors.dark }]}>NUESTRO BLOG</Text>
            <Text style={[styles.sectionBodyCenter, { fontSize: 17, maxWidth: 600 }]}>Explora artículos escritos por expertos para cuidar lo más valioso: tu salud.</Text>
          </FadeInView>

          <View style={[styles.cardsGrid, isDesktop && styles.cardsGridDesktop, { maxWidth: 1200, gap: 32 }]}>
            <HoverBlogCard
              category="SALUD MENTAL"
              title="Grupos de Apoyo y Psicología"
              description="Descubre cómo nuestras reuniones virtuales con especialistas están ayudando a cientos de pacientes a manejar el estrés diario."
              image={SaludMentalImg}
              onPress={() => navigation.navigate('BlogDetail', {
                category: "SALUD MENTAL",
                title: "Grupos de Apoyo y Psicología",
                description: "Descubre cómo nuestras reuniones virtuales con especialistas están ayudando a cientos de pacientes a manejar el estrés diario.",
                image: SaludMentalImg
              })}
              style={{ flex: 1, maxWidth: isDesktop ? 550 : '100%', shadowRadius: 20, elevation: 10 }}
            />
            <HoverBlogCard
              category="PREVENCIÓN"
              title="La importancia del chequeo anual"
              description="Por qué no debes esperar a sentirte mal para agendar una cita con tu médico de confianza. Hábitos saludables que puedes iniciar hoy mismo."
              image={ChequeoImg}
              onPress={() => navigation.navigate('BlogDetail', {
                category: "PREVENCIÓN",
                title: "La importancia del chequeo anual",
                description: "Por qué no debes esperar a sentirte mal para agendar una cita con tu médico de confianza. Hábitos saludables que puedes iniciar hoy mismo.",
                image: ChequeoImg
              })}
              style={{ flex: 1, maxWidth: isDesktop ? 550 : '100%', shadowRadius: 20, elevation: 10 }}
            />
          </View>
        </View>

        {/* FOOTER */}
        <View 
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLayoutY(prev => ({ ...prev, contacto: y }));
          }} 
          style={[styles.footerContainer, isDesktop && { borderTopLeftRadius: 150 }]}
        >
          <View style={[styles.footer, isDesktop && styles.footerDesktop]}>
            <View style={[styles.footerBrandSection, (isTablet || isMobile) && { alignItems: 'center', maxWidth: '100%' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={styles.footerLogoContainer}>
                  <Image source={ViremLogo} style={styles.footerLogoImage} resizeMode="contain" />
                </View>
                <Text style={[styles.logoText, { color: '#fff', fontSize: 32 }]}>VIREM</Text>
              </View>
              <View style={styles.socialRow}>
                <View style={styles.socialCircle}><MaterialIcons name="facebook" size={20} color={colors.secondary} /></View>
                <View style={styles.socialCircle}><MaterialIcons name="camera-alt" size={20} color={colors.secondary} /></View>
                <View style={styles.socialCircle}><MaterialIcons name="flutter-dash" size={20} color={colors.secondary} /></View>
              </View>
            </View>

            <View style={styles.footerLinksColumn}>
              <Text style={styles.footerColumnTitle}>SOBRE VIREM</Text>
              <Text style={styles.footerLinkItem}>Trabaja con nosotros</Text>
              <Text style={styles.footerLinkItem}>Especialistas</Text>
              <Text style={styles.footerLinkItem}>Contacto</Text>
              <Text style={styles.footerLinkItem}>Política de Privacidad</Text>
            </View>

            <View style={styles.footerLinksColumn}>
              <Text style={styles.footerColumnTitle}>CONSULTA Y SERVICIOS</Text>
              <Text style={styles.footerLinkItem}>Especialidades</Text>
              <Text style={styles.footerLinkItem}>Telemedicina</Text>
              <Text style={styles.footerLinkItem}>Recetas Digitales</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },

  // NAVBAR
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, zIndex: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  navbarDesktop: { paddingHorizontal: 40, paddingVertical: 16 },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: { width: 32, height: 32 },
  logoText: { fontSize: 26, fontWeight: '900', color: colors.dark, letterSpacing: 0.5 },

  navLinksCenter: { flexDirection: 'row', gap: 24 },
  navLinkCenterText: { color: colors.primary, fontWeight: '500', fontSize: 15, letterSpacing: -0.5 },

  navRight: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  navBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  // HERO
  heroSection: { backgroundColor: '#EBF5FB' },
  heroDesktop: { flexDirection: 'row', alignItems: 'center', paddingLeft: 80, paddingRight: 0, paddingVertical: 0, width: '100%', minHeight: 550, overflow: 'hidden', position: 'relative' },
  heroTextContainer: { flex: 1, zIndex: 2, maxWidth: '55%' },
  heroTextDesktop: { paddingRight: 40, flex: 1 },
  heroTitle: { fontSize: 48, fontWeight: '900', color: colors.dark, marginBottom: 16, lineHeight: 56 },
  heroSubtitle: { fontSize: 18, color: colors.muted, lineHeight: 28, marginBottom: 30, fontWeight: '400' },
  heroActionBtn: { backgroundColor: colors.primary, paddingHorizontal: 36, paddingVertical: 16, borderRadius: 8, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  heroActionBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  heroImageContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', alignItems: 'flex-end', justifyContent: 'center' },
  heroImage: { width: 650, height: 550, backgroundColor: 'transparent' },

  // HOW IT WORKS
  howItWorksSection: { padding: 24, paddingVertical: 60, backgroundColor: '#fff' },
  howItWorksDesktop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 80 },
  howItWorksImgContainer: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },
  greenCircle: { width: 380, height: 380, borderRadius: 190, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  doctorCircleImage: { width: '90%', height: '90%', borderRadius: 200 },

  howItWorksTextContainer: { flex: 1 },
  howItWorksTextDesktop: { paddingLeft: 60 },
  sectionHeadingLeft: { fontSize: 28, fontWeight: '300', color: '#1A5276', marginBottom: 20 },
  sectionBodyLeft: { fontSize: 15, color: colors.muted, lineHeight: 26, marginBottom: 16 },

  // SERVICES
  servicesSection: { padding: 24, paddingVertical: 60, alignItems: 'center', backgroundColor: '#FDFEFE' },
  sectionHeadingCenter: { fontSize: 28, fontWeight: '300', color: '#1A5276', marginBottom: 16, textAlign: 'center' },
  sectionBodyCenter: { fontSize: 15, color: colors.muted, lineHeight: 26, textAlign: 'center', maxWidth: 800, marginBottom: 40 },

  cardsGrid: { flexDirection: 'column', gap: 24, width: '100%', maxWidth: 1100 },
  cardsGridDesktop: { flexDirection: 'row', justifyContent: 'center' },
  serviceCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  cardHeader: { backgroundColor: colors.primary, paddingVertical: 14, alignItems: 'center' },
  cardHeaderText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  cardImage: { width: '100%', height: 200 },

  // FOOTER
  footerContainer: { backgroundColor: colors.primary, marginTop: 40 },
  footer: { padding: 60, flexDirection: 'column', gap: 30 },
  footerDesktop: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },

  footerBrandSection: { alignItems: 'flex-start', maxWidth: 300 },
  footerLogoContainer: { backgroundColor: '#fff', padding: 6, borderRadius: 8, marginRight: 12 },
  footerLogoImage: { width: 28, height: 28 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  footerLinksColumn: { gap: 10 },
  footerColumnTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 15 },
  footerLinkItem: { color: '#fff', fontSize: 14, fontWeight: '400', marginBottom: 6 },
});

export default LandingScreen;
// Trigger hot reload
