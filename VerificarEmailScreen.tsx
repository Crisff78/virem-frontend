import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { createRef, useRef, useState } from 'react';
import { 
  Keyboard, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  Alert, 
  ActivityIndicator, 
  useWindowDimensions,
  Platform
} from 'react-native';
import { RootStackParamList } from './navigation/types';
import { requestJson } from './utils/api';

type VerificarEmailRouteProp = RouteProp<RootStackParamList, 'VerificarEmail'>;
type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'VerificarEmail'>;

const colors = {
    primary: '#137fec',
    primaryLight: '#e0f2fe',
    background: '#F6FAFD',
    textPrimary: '#0A1931',
    textSecondary: '#4A7FA7',
    border: '#cbd5e1',
    card: '#FFFFFF',
    success: '#16a34a',
    white: '#FFFFFF',
};

const VerificarEmailScreen: React.FC = () => {
    const route = useRoute<VerificarEmailRouteProp>();
    const navigation = useNavigation<NavigationProps>();
    const [isLoading, setIsLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const { width } = useWindowDimensions();

    const recipient = route.params?.email || '';
    const roleId = route.params?.roleId || 1; // Default to patient
    const pendingRegistration = route.params?.pendingRegistration === true;

    const OTP_LENGTH = 6;
    const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
    const inputRefs = useRef<Array<React.RefObject<TextInput | null>>>([]);
    
    const cardWidth = Math.max(320, Math.min(480, width - 32));
    const otpBoxSize = width < 380 ? 40 : 50;

    if (inputRefs.current.length === 0) {
        inputRefs.current = Array(OTP_LENGTH).fill(0).map(() => createRef<TextInput | null>());
    }

    const handleOtpChange = (text: string, index: number) => {
        const onlyDigits = String(text || '').replace(/\D/g, '');
        const newOtp = [...otp];

        if (!onlyDigits) {
            newOtp[index] = '';
            setOtp(newOtp);
            return;
        }

        if (onlyDigits.length > 1) {
            let cursor = index;
            for (const digit of onlyDigits) {
                if (cursor >= OTP_LENGTH) break;
                newOtp[cursor] = digit;
                cursor += 1;
            }
            setOtp(newOtp);

            if (cursor < OTP_LENGTH) {
                inputRefs.current[cursor].current?.focus();
            } else {
                Keyboard.dismiss();
            }
            return;
        }

        newOtp[index] = onlyDigits;
        setOtp(newOtp);
        if (index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1].current?.focus();
        } else {
            Keyboard.dismiss();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs.current[index - 1].current?.focus();
        }
    };

    const handleVerifyCode = async () => {
        const code = otp.join('');
        if (code.length !== OTP_LENGTH) {
            Alert.alert('Código incompleto', 'Por favor ingresa los 6 dígitos enviados a tu correo.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await requestJson<any>(pendingRegistration ? '/api/auth/register/confirm' : '/api/auth/verify-email', {
                method: 'POST',
                body: { email: recipient, codigo: code },
            });

            if (data?.success) {
                const isMedico = roleId === 2;
                let finalMessage = 'Tu correo ha sido verificado correctamente.';
                if (isMedico) {
                    finalMessage += '\n\nTu cuenta profesional está ahora en proceso de revisión administrativa. Te notificaremos por correo cuando sea aprobada.';
                } else {
                    finalMessage += '\n\nYa puedes iniciar sesión en tu cuenta.';
                }

                Alert.alert("¡Verificado!", finalMessage, [
                    { text: "Ir al Login", onPress: () => navigation.replace('Login', { prefillEmail: recipient }) }
                ]);
            } else {
                Alert.alert("Error", data?.message || "Código incorrecto o expirado.");
            }
        } catch (error) {
            Alert.alert("Error", (error as any)?.message || "No se pudo conectar con el servidor.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!recipient) {
            Alert.alert('Error', 'No se encontró el correo para reenviar el código.');
            return;
        }

        setResendLoading(true);
        try {
            const data = await requestJson<any>(pendingRegistration ? '/api/auth/resend-verification-pending' : '/api/auth/resend-verification', {
                method: 'POST',
                body: { email: recipient },
            });
            if (data?.success) {
                const devSuffix = data?.devVerificationCode ? `\n\n(Dev Code: ${data.devVerificationCode})` : '';
                Alert.alert('Código Reenviado', `Hemos enviado un nuevo código a ${recipient}.${devSuffix}`);
            } else {
                Alert.alert('Error', data?.message || 'No se pudo reenviar el código.');
            }
        } catch (error) {
            Alert.alert('Error', (error as any)?.message || 'No se pudo conectar con el servidor.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <ScrollView
            style={styles.mainContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            <View style={[styles.card, { width: cardWidth }]}>
                <View style={styles.headerIcon}>
                    <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.primary} />
                </View>
                
                <Text style={styles.title}>Verifica tu Correo</Text>
                <Text style={styles.subtitle}>
                    Para asegurar tu cuenta, introduce el código de {OTP_LENGTH} dígitos que enviamos a:
                </Text>
                <Text style={styles.emailText}>{recipient}</Text>

                <View style={styles.otpContainer}>
                    {otp.map((digit: string, index: number) => (
                        <TextInput
                            key={index}
                            ref={inputRefs.current[index]}
                            style={[
                                styles.otpInput, 
                                { width: otpBoxSize, height: otpBoxSize + 12 },
                                digit ? styles.otpInputFilled : null
                            ]}
                            value={digit}
                            onChangeText={(text: string) => handleOtpChange(text, index)}
                            onKeyPress={(e: any) => handleKeyPress(e, index)}
                            keyboardType="numeric"
                            maxLength={1}
                            autoFocus={index === 0}
                            placeholder="-"
                            placeholderTextColor={colors.border}
                        />
                    ))}
                </View>

                <TouchableOpacity 
                    style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]} 
                    onPress={handleVerifyCode} 
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.verifyButtonText}>Confirmar Código</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                    <Text style={styles.resendLabel}>¿No recibiste el correo?</Text>
                    <TouchableOpacity onPress={handleResendCode} disabled={resendLoading}>
                        <Text style={styles.resendLink}>
                            {resendLoading ? 'Enviando...' : 'Reenviar código'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.replace('Login', { prefillEmail: recipient })}
                >
                    <Text style={styles.backButtonText}>Volver al inicio de sesión</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
            android: { elevation: 8 },
            web: { boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }
        })
    },
    headerIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 12,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 8
    },
    emailText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 32,
        textAlign: 'center'
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 32
    },
    otpInput: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.background,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    otpInputFilled: {
        borderColor: colors.primary,
        backgroundColor: colors.white,
    },
    verifyButton: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },
    verifyButtonDisabled: {
        opacity: 0.7
    },
    verifyButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold'
    },
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32
    },
    resendLabel: {
        color: colors.textSecondary,
        fontSize: 15
    },
    resendLink: {
        color: colors.primary,
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 15
    },
    backButton: {
        padding: 8
    },
    backButtonText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500'
    }
});

export default VerificarEmailScreen;
