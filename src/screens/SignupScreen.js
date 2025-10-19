import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { createAccountDirectly } from '../utils/auth';
import { getStepValidation } from '../utils/validation';

SplashScreen.preventAutoHideAsync();

const COLORS = {
  background: '#F8F5ED',
  orange: '#F28C4A',
  teal: '#50A8A8',
  lightGreyText: '#888888',
  shadowGrey: 'rgba(0, 0, 0, 0.2)',
  white: '#FFFFFF',
  error: '#FF6B6B',
  success: '#4CAF50',
};

const { width } = Dimensions.get('window');

const REGIONS = ['NCR', 'Region I', 'Region II', 'Region III'];
const PROVINCES = {
  'NCR': ['Metro Manila'],
  'Region I': ['Ilocos Norte', 'Ilocos Sur'],
  'Region II': ['Cagayan', 'Isabela'],
  'Region III': ['Bulacan', 'Pampanga'],
};
const CITIES = {
  'Metro Manila': ['Quezon City', 'Manila', 'Pasig'],
  'Ilocos Norte': ['Laoag'],
  'Ilocos Sur': ['Vigan'],
  'Cagayan': ['Tuguegarao'],
  'Isabela': ['Ilagan'],
  'Bulacan': ['Malolos'],
  'Pampanga': ['San Fernando'],
};
const BARANGAYS = {
  'Quezon City': ['Batasan Hills', 'Commonwealth'],
  'Manila': ['Ermita', 'Malate'],
  'Pasig': ['Ugong', 'Manggahan'],
  'Laoag': ['Barangay 1', 'Barangay 2'],
  'Vigan': ['Ayusan Norte', 'Ayusan Sur'],
  'Tuguegarao': ['Ugac Norte', 'Ugac Sur'],
  'Ilagan': ['San Vicente', 'San Felipe'],
  'Malolos': ['Longos', 'Sumapang Matanda'],
  'San Fernando': ['Del Pilar', 'Dolores'],
};

const toDropdown = (arr) => arr.map((v) => ({ label: v, value: v }));

const SignupScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const contentPadding = width < 380 ? 16 : 24;
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Step 2
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [barangay, setBarangay] = useState('');

  // Step 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const canNextFromStep1 = firstName.trim() && lastName.trim() && email.trim();
  const canNextFromStep2 = region && province && city && barangay;
  const canSubmit = password && confirmPassword && password === confirmPassword;

  const onChangeRegion = (val) => {
    setRegion(val);
    setProvince('');
    setCity('');
    setBarangay('');
    clearErrors(['province', 'city', 'barangay']);
  };

  const onChangeProvince = (val) => {
    setProvince(val);
    setCity('');
    setBarangay('');
    clearErrors(['city', 'barangay']);
  };

  const onChangeCity = (val) => {
    setCity(val);
    setBarangay('');
    clearErrors(['barangay']);
  };

  const clearErrors = (fields) => {
    const newErrors = { ...errors };
    fields.forEach(field => delete newErrors[field]);
    setErrors(newErrors);
  };

  const validateAndProceed = (nextStep) => {
    const currentFormData = {
      firstName,
      middleName,
      lastName,
      email,
      region,
      province,
      city,
      barangay,
      password,
      confirmPassword,
    };

    const validation = getStepValidation(step, currentFormData);
    
    if (validation.isValid) {
      setErrors({});
      setStep(nextStep);
    } else {
      setErrors(validation.errors);
    }
  };

  const handleSubmit = async () => {
    const formData = {
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      region,
      province,
      city,
      barangay,
      password,
      confirmPassword,
    };

    const validation = getStepValidation(3, formData);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      console.log('🚀 Direct account creation - no OTP required');
      
      // Create account directly using Firebase Auth
      const result = await createAccountDirectly(formData);
      
      if (result.success) {
        console.log('✅ Account created successfully!');
        Alert.alert(
          '🎉 Welcome to COPit!',
          'Your account has been created successfully! You will be redirected to the home page.',
          [
            {
              text: 'OK',
              onPress: () => {} // No navigation needed - AuthContext will handle it
            }
          ]
        );
      } else {
        setErrors({ general: result.error });
      }
    } catch (error) {
      console.error('Account creation error:', error);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicators = () => (
    <View style={styles.stepper}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive]} />
      ))}
    </View>
  );

  const renderError = (field) => {
    if (errors[field]) {
      return <Text style={styles.errorText}>{errors[field]}</Text>;
    }
    return null;
  };

  const renderGeneralError = () => {
    if (errors.general) {
      return (
        <View style={styles.generalErrorContainer}>
          <Text style={styles.generalErrorText}>{errors.general}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} onLayout={onLayoutRootView}>
      <ScrollView contentContainerStyle={[styles.scrollViewContent, { paddingHorizontal: contentPadding }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[styles.backButton, { top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) }]} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.teal} />
        </TouchableOpacity>

        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the COPit community and start thrifting!</Text>

        {renderStepIndicators()}

        {renderGeneralError()}

        {step === 1 && (
          <View style={styles.formRowWrap}>
            <TextInput 
              style={[styles.input, errors.firstName && styles.inputError]} 
              placeholder="First name" 
              placeholderTextColor={COLORS.lightGreyText} 
              autoCapitalize="words" 
              value={firstName} 
              onChangeText={(text) => {
                setFirstName(text);
                if (errors.firstName) clearErrors(['firstName']);
              }}
            />
            {renderError('firstName')}

            <TextInput 
              style={[styles.input, errors.middleName && styles.inputError]} 
              placeholder="Middle name (optional)" 
              placeholderTextColor={COLORS.lightGreyText} 
              autoCapitalize="words" 
              value={middleName} 
              onChangeText={(text) => {
                setMiddleName(text);
                if (errors.middleName) clearErrors(['middleName']);
              }}
            />
            {renderError('middleName')}

            <TextInput 
              style={[styles.input, errors.lastName && styles.inputError]} 
              placeholder="Last name" 
              placeholderTextColor={COLORS.lightGreyText} 
              autoCapitalize="words" 
              value={lastName} 
              onChangeText={(text) => {
                setLastName(text);
                if (errors.lastName) clearErrors(['lastName']);
              }}
            />
            {renderError('lastName')}

            <TextInput 
              style={[styles.input, errors.email && styles.inputError]} 
              placeholder="Enter your email" 
              placeholderTextColor={COLORS.lightGreyText} 
              keyboardType="email-address" 
              autoCapitalize="none" 
              value={email} 
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) clearErrors(['email']);
              }}
            />
            {renderError('email')}

            <TouchableOpacity 
              style={[styles.primaryBtnFull, !canNextFromStep1 && styles.btnDisabled]} 
              onPress={() => canNextFromStep1 && validateAndProceed(2)} 
              activeOpacity={canNextFromStep1 ? 0.7 : 1}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.formRowWrap}>
            <Dropdown 
              style={[styles.dropdown, errors.region && styles.dropdownError]} 
              data={toDropdown(REGIONS)} 
              labelField="label" 
              valueField="value" 
              placeholder="Select Region" 
              value={region} 
              onChange={(item) => onChangeRegion(item.value)} 
            />
            {renderError('region')}

            <Dropdown 
              style={[styles.dropdown, errors.province && styles.dropdownError]} 
              data={toDropdown(PROVINCES[region] || [])} 
              labelField="label" 
              valueField="value" 
              placeholder="Select Province" 
              value={province} 
              onChange={(item) => onChangeProvince(item.value)} 
              disable={!region} 
            />
            {renderError('province')}

            <Dropdown 
              style={[styles.dropdown, errors.city && styles.dropdownError]} 
              data={toDropdown(CITIES[province] || [])} 
              labelField="label" 
              valueField="value" 
              placeholder="Select City / Municipality" 
              value={city} 
              onChange={(item) => onChangeCity(item.value)} 
              disable={!province} 
            />
            {renderError('city')}

            <Dropdown 
              style={[styles.dropdown, errors.barangay && styles.dropdownError]} 
              data={toDropdown(BARANGAYS[city] || [])} 
              labelField="label" 
              valueField="value" 
              placeholder="Select Barangay" 
              value={barangay} 
              onChange={(item) => {
                setBarangay(item.value);
                if (errors.barangay) clearErrors(['barangay']);
              }} 
              disable={!city} 
            />
            {renderError('barangay')}

            <TouchableOpacity 
              style={[styles.primaryBtnFull, !canNextFromStep2 && styles.btnDisabled]} 
              onPress={() => canNextFromStep2 && validateAndProceed(3)} 
              activeOpacity={canNextFromStep2 ? 0.7 : 1}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.formRowWrap}>
            <TextInput 
              style={[styles.input, errors.password && styles.inputError]} 
              placeholder="Create a password" 
              placeholderTextColor={COLORS.lightGreyText} 
              secureTextEntry 
              value={password} 
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) clearErrors(['password']);
              }}
            />
            {renderError('password')}

            <TextInput 
              style={[styles.input, errors.confirmPassword && styles.inputError]} 
              placeholder="Confirm your password" 
              placeholderTextColor={COLORS.lightGreyText} 
              secureTextEntry 
              value={confirmPassword} 
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) clearErrors(['confirmPassword']);
              }}
            />
            {renderError('confirmPassword')}

            <TouchableOpacity 
              style={[styles.primaryBtnFull, (!canSubmit || isLoading) && styles.btnDisabled]} 
              onPress={handleSubmit} 
              activeOpacity={(canSubmit && !isLoading) ? 0.7 : 1}
              disabled={!canSubmit || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
              <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.legalTextContainer}>
          <Text style={styles.legalText}>By creating an account, you agree to our <Text style={styles.legalLink}>Terms of Service</Text> and <Text style={styles.legalLink}>Privacy Policy</Text></Text>
        </View>

        <View style={styles.loginPromptContainer}>
          <Text style={styles.loginPromptText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.replace('LoginScreen')}>
          <Text style={styles.loginLinkText}>Sign In</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.bottomPhraseContainer}>
          <Text style={styles.bottomPhrase}>Pag nakita mo na, <Text style={{ color: COLORS.orange }}>COPit-in mo!</Text></Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollViewContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  backButton: { position: 'absolute', left: 20, zIndex: 1 },
  logo: { width: 100, height: 100, resizeMode: 'contain', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 28, fontFamily: 'Poppins-Bold', textAlign: 'center', marginBottom: 10, color: COLORS.teal },
  subtitle: { fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 24, color: COLORS.lightGreyText, paddingHorizontal: 20 },

  formRowWrap: { width: '100%', maxWidth: 520 },

  input: {
    width: '100%', height: 48, backgroundColor: COLORS.background, borderRadius: 25, borderWidth: 1, borderColor: COLORS.orange,
    paddingHorizontal: 20, fontSize: 16, fontFamily: 'Poppins-Regular', color: COLORS.teal, marginBottom: 12,
    shadowColor: COLORS.shadowGrey, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },

  inputError: {
    borderColor: COLORS.error,
  },

  dropdown: { width: '100%', height: 48, borderRadius: 25, borderWidth: 1, borderColor: COLORS.orange, paddingHorizontal: 12, backgroundColor: COLORS.background, marginBottom: 12 },

  dropdownError: {
    borderColor: COLORS.error,
  },

  stepper: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D7DFE1' },
  stepDotActive: { backgroundColor: COLORS.orange },

  primaryBtnFull: { width: '100%', height: 50, backgroundColor: COLORS.teal, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 20, elevation: 8, shadowColor: COLORS.shadowGrey, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  primaryBtnText: { color: COLORS.white, fontSize: 18, fontFamily: 'Poppins-Bold' },
  btnDisabled: { opacity: 0.5 },

  errorText: {
    color: COLORS.error,
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 20,
    alignSelf: 'flex-start',
  },

  generalErrorContainer: {
    backgroundColor: COLORS.error + '20',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 520,
  },

  generalErrorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },

  legalTextContainer: { width: '100%', alignItems: 'center', marginTop: 16, marginBottom: 16 },
  legalText: { fontSize: 10, fontFamily: 'Poppins-Regular', textAlign: 'center', color: COLORS.lightGreyText, lineHeight: 14 },
  legalLink: { color: COLORS.orange, textDecorationLine: 'underline' },

  loginPromptContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  loginPromptText: { fontSize: 14, fontFamily: 'Poppins-Regular', color: COLORS.lightGreyText },
  loginLinkText: { fontSize: 14, fontFamily: 'Poppins-Regular', color: COLORS.orange, textDecorationLine: 'underline' },

  bottomPhraseContainer: { marginTop: 24, marginBottom: 12, width: '100%', alignItems: 'center' },
  bottomPhrase: { fontSize: 18, fontFamily: 'Poppins-Bold', textAlign: 'center', color: COLORS.teal },
});

export default SignupScreen;
