import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigation/types';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type BlogDetailRouteProp = RouteProp<RootStackParamList, 'BlogDetail'>;

const colors = {
  primary: '#2B6CB0',
  secondary: '#1A365D',
  dark: '#0F172A',
  muted: '#475569',
  bg: '#F8FAFC',
  white: '#FFFFFF',
};

const BlogDetailScreen: React.FC = () => {
  const route = useRoute<BlogDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { category, title, description, image } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header / Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.dark} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Category Badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{category}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Featured Image */}
        <Image source={typeof image === 'string' ? { uri: image } : image} style={styles.featuredImage} resizeMode="cover" />

        {/* Description / Content */}
        <View style={styles.articleBody}>
          <Text style={styles.introText}>{description}</Text>
          
          <Text style={styles.paragraph}>
            En VIREM, nos preocupamos por mantenerte informado con las últimas tendencias y consejos de salud. 
            Este artículo es parte de nuestra iniciativa para fomentar una cultura de prevención y cuidado integral.
          </Text>

          <Text style={styles.sectionTitle}>¿Por qué es importante?</Text>
          <Text style={styles.paragraph}>
            La información adecuada es el primer paso hacia una vida más saludable. Al entender los factores de riesgo 
            y las señales que nuestro cuerpo nos envía, podemos tomar decisiones más acertadas y oportunas.
          </Text>

          <View style={styles.quoteBox}>
            <MaterialIcons name="format-quote" size={32} color={colors.primary} style={{ marginBottom: 10 }} />
            <Text style={styles.quoteText}>
              "La salud no es solo la ausencia de enfermedad, sino un estado de completo bienestar físico, mental y social."
            </Text>
          </View>

          <Text style={styles.paragraph}>
            Continuaremos expandiendo esta sección con más recursos y guías prácticas para ti y tu familia. 
            Recuerda que siempre puedes agendar una cita con nuestros especialistas si necesitas una atención más personalizada.
          </Text>
        </View>
      </View>

      {/* Footer CTA */}
      <View style={styles.footerCTA}>
        <Text style={styles.ctaTitle}>¿Necesitas hablar con un profesional?</Text>
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Landing' as any)}
        >
          <Text style={styles.ctaButtonText}>Agendar una consulta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: { paddingBottom: 60 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.dark },
  content: { paddingHorizontal: 20, maxWidth: 800, alignSelf: 'center', width: '100%' },
  categoryBadge: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  categoryText: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: '900', color: colors.dark, marginBottom: 24, lineHeight: 40 },
  featuredImage: { width: '100%', height: 400, borderRadius: 24, marginBottom: 40 },
  articleBody: { gap: 20 },
  introText: { fontSize: 20, fontWeight: '500', color: colors.secondary, lineHeight: 30, marginBottom: 10 },
  paragraph: { fontSize: 17, color: colors.muted, lineHeight: 28 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: colors.dark, marginTop: 20, marginBottom: 10 },
  quoteBox: {
    backgroundColor: '#F8FAFC',
    padding: 30,
    borderRadius: 20,
    marginVertical: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  quoteText: { fontSize: 18, fontStyle: 'italic', color: colors.secondary, lineHeight: 28 },
  footerCTA: {
    marginTop: 60,
    padding: 40,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 30,
  },
  ctaTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  ctaButton: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default BlogDetailScreen;
