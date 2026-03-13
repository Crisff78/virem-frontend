import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { createRef, useRef, useState } from 'react';
import { Dimensions, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { apiUrl } from './config/backend';
import { RootStackParamList } from './navigation/types';

type VerificarIdentidadRouteProp = RouteProp<RootStackParamList, 'VerificarIdentidad'>;
type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'VerificarIdentidad'>;

const { width } = Dimensions.get('window');

const colors = {
    primary: '#4A7FA7', 
    backgroundLight: '#F6FAFD', 
    textPrimaryLight: '#0A1931', 
    textSecondaryLight: '#1A3D63', 
    borderLight: '#B3CFE5', 
    cardLight: '#FFFFFF',
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: colors.backgroundLight, alignItems: 'center', justifyContent: 'center', padding: 16 },
    cardContainer: { width: width < 400 ? '95%' : 380, backgroundColor: colors.cardLight, borderRadius: 12, elevation: 5, padding: 32, alignItems: 'center' },
    iconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(74, 127, 167, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    icon: { color: colors.primary },
    title: { color: colors.textPrimaryLight, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    subtitle: { color: colors.textSecondaryLight, fontSize: 16, textAlign: 'center', marginBottom: 24 },
    otpContainer: { flexDirection: 'row', justifyContent: 'center', width: '100%', gap: 10, alignSelf: 'center' },
    otpInput: { width: 45, height: 56, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, backgroundColor: colors.backgroundLight, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.textPrimaryLight },
    verifyButton: { width: '100%', height: 48, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    buttonText: { color: colors.cardLight, fontSize: 16, fontWeight: 'bold' },
    resendTextWrapper: { flexDirection: 'row', marginTop: 16 },
    resendText: { color: colors.textSecondaryLight, fontSize: 14 },
    resendLink: { color: colors.primary, fontWeight: 'bold', textDecorationLine: 'underline' }
});

const VerificarIdentidadScreen: React.FC = () => {
    const route = useRoute<VerificarIdentidadRouteProp>();
    const navigation = useNavigation<NavigationProps>();
    const [isLoading, setIsLoading] = useState(false);
    
    const recipient = route.params?.email || 'tu correo electronico'; 
    const OTP_LENGTH = 6;
    const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
    const inputRefs = useRef<Array<React.RefObject<TextInput | null>>>([]);

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
            Alert.alert('Incompleto', 'Ingresa el codigo completo.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(apiUrl('/api/auth/recovery/verify-code'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: recipient, codigo: code }),
            });
            const data = await response.json().catch(() => null);

            if (response.ok && data?.success) {
                navigation.navigate('EstablecerNuevaContrasena', { email: recipient }); 
            } else {
                Alert.alert("Error", data?.message || "Codigo incorrecto o expirado.");
            }
        } catch (error) {
            Alert.alert("Error", "Sin conexion al servidor.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.mainContainer}>
            <View style={styles.cardContainer}>
                <View style={styles.iconWrapper}><MaterialCommunityIcons name="shield-lock" size={40} style={styles.icon} /></View>
                <Text style={styles.title}>Verifica tu Identidad</Text>
                <Text style={styles.subtitle}>Introduce el codigo enviado a {recipient}.</Text>
                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput key={index} ref={inputRefs.current[index]} style={styles.otpInput} value={digit} onChangeText={(text) => handleOtpChange(text, index)} onKeyPress={(e) => handleKeyPress(e, index)} keyboardType="numeric" maxLength={1} autoFocus={index === 0} />
                    ))}
                </View>
                <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyCode} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Verificar Codigo</Text>}
                </TouchableOpacity>
                <View style={styles.resendTextWrapper}>
                    <Text style={styles.resendText}>No recibiste el codigo? <TouchableOpacity><Text style={styles.resendLink}>Reenviar</Text></TouchableOpacity></Text>
                </View>
            </View>
        </View>
    );
};

export default VerificarIdentidadScreen;
