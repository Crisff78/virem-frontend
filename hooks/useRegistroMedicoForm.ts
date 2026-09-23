import { Alert, Platform } from "react-native";
import { useCallback, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/types";
import { createMedicoDraftKey, persistMedicoDraft } from "../utils/medicoRegistrationDraft";
import {
  applyPhoneMask,
  buildPersistentPhotoUri,
  CountryCodeType,
  countryCodes,
  ESPECIALIDADES,
  esFechaValida,
  esMayorDe18,
  filterOnlyLetters,
  formatCedulaRD,
  GENDER_OPTIONS,
  normalizeFullName,
  RegistroMedicoDraftPayload,
  toWebDataUrl,
  updateMaskedDateInput,
  validarCedulaDominicana,
  validarExequaturPorNombre,
  validarQueSeaPersona,
  validarTelefonoBackend,
} from "../utils/registroMedico";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "RegistroMedico">;

type RegistroMedicoFormValues = {
  nombreCompleto: string;
  birthDate: string;
  gender: string;
  cedula: string;
  phone: string;
  selectedCountryCode: CountryCodeType;
  especialidad: string;
  espQuery: string;
  fotoUri: string;
};

type RegistroMedicoFormErrors = {
  showErrors: boolean;
  fotoError: boolean;
  cedulaError: boolean;
  fechaError: boolean;
  fechaMayor18Error: boolean;
  telefonoError: string;
  especialidadError: boolean;
  exequaturError: string;
};

type RegistroMedicoModalState = {
  showGenderModal: boolean;
  showPrefixModal: boolean;
  showEspModal: boolean;
};

export type RegistroMedicoDocumentField = never;

export type RegistroMedicoFormController = {
  values: RegistroMedicoFormValues;
  errors: RegistroMedicoFormErrors;
  modals: RegistroMedicoModalState;
  isLoading: boolean;
  isFormComplete: boolean;
  progressPercent: number;
  especialidadesFiltradas: string[];
  countryCodeOptions: CountryCodeType[];
  genderOptions: readonly string[];
  setNombreCompleto: (value: string) => void;
  setCedula: (value: string) => void;
  setBirthDate: (value: string) => void;
  setPhone: (value: string) => void;
  setEspecialidadQuery: (value: string) => void;
  openGenderModal: () => void;
  closeGenderModal: () => void;
  selectGender: (value: string) => void;
  openPrefixModal: () => void;
  closePrefixModal: () => void;
  selectCountryCode: (value: CountryCodeType) => void;
  openEspecialidadModal: () => void;
  closeEspecialidadModal: () => void;
  selectEspecialidad: (value: string) => void;
  pickImage: () => Promise<void>;
  pickSupportingDocument: (field: RegistroMedicoDocumentField) => Promise<void>;
  handleContinue: () => Promise<void>;
  handleCancel: () => void;
};

const INITIAL_VALUES: RegistroMedicoFormValues = {
  nombreCompleto: "",
  birthDate: "",
  gender: "",
  cedula: "",
  phone: "",
  selectedCountryCode: countryCodes[0],
  especialidad: "",
  espQuery: "",
  fotoUri: "",
};

const INITIAL_ERRORS: RegistroMedicoFormErrors = {
  showErrors: false,
  fotoError: false,
  cedulaError: false,
  fechaError: false,
  fechaMayor18Error: false,
  telefonoError: "",
  especialidadError: false,
  exequaturError: "",
};

const INITIAL_MODALS: RegistroMedicoModalState = {
  showGenderModal: false,
  showPrefixModal: false,
  showEspModal: false,
};

const DOCUMENT_FIELDS: any[] = [];

export function useRegistroMedicoForm(
  navigation: NavigationProps
): RegistroMedicoFormController {
  const [values, setValues] = useState<RegistroMedicoFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<RegistroMedicoFormErrors>(INITIAL_ERRORS);
  const [modals, setModals] = useState<RegistroMedicoModalState>(INITIAL_MODALS);
  const [isLoading, setIsLoading] = useState(false);

  const isFormComplete = useMemo(
    () =>
      values.nombreCompleto.trim() !== "" &&
      values.birthDate.trim() !== "" &&
      values.gender !== "" &&
      values.cedula.trim() !== "" &&
      values.phone.trim() !== "" &&
      values.especialidad.trim() !== "" &&
      !!values.fotoUri,
    [values]
  );

  const progressPercent = useMemo(() => {
    const completedFields = [
      values.nombreCompleto,
      values.birthDate,
      values.gender,
      values.cedula,
      values.phone,
      values.especialidad,
      values.fotoUri,
    ].filter((value) => value.trim() !== "").length;

    return Math.round((completedFields / 7) * 100);
  }, [values]);

  const especialidadesFiltradas = useMemo(() => {
    const query = values.espQuery.trim().toLowerCase();
    if (!query) return ESPECIALIDADES;
    return ESPECIALIDADES.filter((especialidad) =>
      especialidad.toLowerCase().includes(query)
    );
  }, [values.espQuery]);

  const updateValues = useCallback((patch: Partial<RegistroMedicoFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  const updateErrors = useCallback((patch: Partial<RegistroMedicoFormErrors>) => {
    setErrors((current) => ({ ...current, ...patch }));
  }, []);

  const updateModals = useCallback((patch: Partial<RegistroMedicoModalState>) => {
    setModals((current) => ({ ...current, ...patch }));
  }, []);

  const setNombreCompleto = useCallback(
    (value: string) => {
      updateValues({ nombreCompleto: filterOnlyLetters(value) });
      updateErrors({ exequaturError: "" });
    },
    [updateErrors, updateValues]
  );

  const setCedula = useCallback(
    (value: string) => {
      updateValues({ cedula: formatCedulaRD(value) });
      updateErrors({ cedulaError: false });
    },
    [updateErrors, updateValues]
  );

  const setBirthDate = useCallback(
    (value: string) => {
      updateValues({ birthDate: updateMaskedDateInput(value) });
      updateErrors({ fechaError: false, fechaMayor18Error: false });
    },
    [updateErrors, updateValues]
  );

  const setPhone = useCallback(
    (value: string) => {
      updateValues({
        phone: applyPhoneMask(value, values.selectedCountryCode.mask),
      });
      updateErrors({ telefonoError: "" });
    },
    [updateErrors, updateValues, values.selectedCountryCode.mask]
  );

  const setEspecialidadQuery = useCallback(
    (value: string) => {
      updateValues({ espQuery: value });
    },
    [updateValues]
  );

  const openGenderModal = useCallback(() => updateModals({ showGenderModal: true }), [updateModals]);
  const closeGenderModal = useCallback(() => updateModals({ showGenderModal: false }), [updateModals]);
  const openPrefixModal = useCallback(() => updateModals({ showPrefixModal: true }), [updateModals]);
  const closePrefixModal = useCallback(() => updateModals({ showPrefixModal: false }), [updateModals]);
  const openEspecialidadModal = useCallback(
    () => updateModals({ showEspModal: true }),
    [updateModals]
  );
  const closeEspecialidadModal = useCallback(() => {
    updateModals({ showEspModal: false });
    updateValues({ espQuery: "" });
  }, [updateModals, updateValues]);

  const selectGender = useCallback(
    (value: string) => {
      updateValues({ gender: value });
      closeGenderModal();
    },
    [closeGenderModal, updateValues]
  );

  const selectCountryCode = useCallback(
    (value: CountryCodeType) => {
      updateValues({ selectedCountryCode: value, phone: "" });
      updateErrors({ telefonoError: "" });
      closePrefixModal();
    },
    [closePrefixModal, updateErrors, updateValues]
  );

  const selectEspecialidad = useCallback(
    (value: string) => {
      updateValues({ especialidad: value, espQuery: "" });
      updateErrors({ especialidadError: false });
      updateModals({ showEspModal: false });
    },
    [updateErrors, updateModals, updateValues]
  );

  const pickImage = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permiso requerido", "Necesitamos permiso para acceder a tus fotos.");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        base64: true,
      });

      if (result.canceled) return;
      const pickedAsset = result.assets[0];
      const sourceUri = String(pickedAsset?.uri || "").trim();
      const baseUri = buildPersistentPhotoUri(pickedAsset);
      const persistentUri = await toWebDataUrl(baseUri);
      if (!persistentUri) return;

      updateValues({ fotoUri: persistentUri });
      updateErrors({ fotoError: false });

      if (Platform.OS !== "web" && sourceUri) {
        setIsLoading(true);
        const hasVisibleFace = await validarQueSeaPersona(sourceUri);
        setIsLoading(false);

        if (!hasVisibleFace) {
          updateValues({ fotoUri: "" });
          updateErrors({ fotoError: true });
          Alert.alert(
            "Foto no válida",
            "Selecciona una foto donde se vea claramente el rostro de una persona."
          );
        }
      }
    } catch {
      setIsLoading(false);
      Alert.alert("Error", "No se pudo abrir el selector de imágenes.");
    }
  }, [updateErrors, updateValues]);

  const pickSupportingDocument = useCallback(
    async (field: any) => {},
    []
  );

  const handleContinue = useCallback(async () => {
    setErrors((current) => ({
      ...current,
      showErrors: true,
      cedulaError: false,
      fechaError: false,
      fechaMayor18Error: false,
      telefonoError: "",
      especialidadError: false,
      fotoError: false,
      exequaturError: "",
    }));

    if (!values.fotoUri) {
      updateErrors({ fotoError: true });
      Alert.alert("Acción Requerida", "Debes subir una foto (rostro visible).");
      return;
    }

    if (!isFormComplete) {
      Alert.alert("Acción Requerida", "Debe completar todos los datos del médico.");
      return;
    }

    if (!esFechaValida(values.birthDate)) {
      updateErrors({ fechaError: true });
      Alert.alert("Fecha Inválida", "La fecha de nacimiento no es real o es incorrecta.");
      return;
    }

    if (!esMayorDe18(values.birthDate)) {
      updateErrors({ fechaMayor18Error: true });
      Alert.alert("Edad no permitida", "El médico debe ser mayor de 18 años.");
      return;
    }

    if (values.selectedCountryCode.name === "República Dominicana") {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const isValidCedula = validarCedulaDominicana(values.cedula);
      setIsLoading(false);

      if (!isValidCedula) {
        updateErrors({ cedulaError: true });
        Alert.alert("Cédula Inválida", "El número de cédula no es válido.");
        return;
      }
    }

    setIsLoading(true);
    const telefonoValidation = await validarTelefonoBackend(
      values.selectedCountryCode.code,
      values.phone
    );
    setIsLoading(false);

    if (telefonoValidation.ok === false) {
      updateErrors({ telefonoError: telefonoValidation.reason });
      Alert.alert("Teléfono inválido", telefonoValidation.reason);
      return;
    }

    const nombreCompletoTrim = normalizeFullName(values.nombreCompleto);

    if (nombreCompletoTrim.split(/\s+/).filter(Boolean).length < 2) {
      const reason = "Verifica el nombre completo tal como aparece en el SNS.";
      updateErrors({ exequaturError: reason });
      Alert.alert(
        "Nombre requerido",
        "Escribe el nombre completo tal como aparece en el Exequatur del SNS."
      );
      return;
    }

    setIsLoading(true);
    const exequaturValidation = await validarExequaturPorNombre(nombreCompletoTrim);
    setIsLoading(false);

    if (exequaturValidation.ok === false) {
      updateErrors({ exequaturError: exequaturValidation.reason });
      Alert.alert("Médico no verificado", exequaturValidation.reason);
      return;
    }

    const exequaturValidationToken =
      typeof exequaturValidation.meta?.validationToken === "string"
        ? exequaturValidation.meta.validationToken
        : undefined;

    const draftPayload: RegistroMedicoDraftPayload = {
      nombreCompleto: nombreCompletoTrim,
      fechanacimiento: values.birthDate,
      genero: values.gender,
      especialidad: values.especialidad,
      cedula: values.cedula,
      telefono: `${values.selectedCountryCode.code} ${values.phone}`,
      fotoUrl: String(values.fotoUri || "").trim() || undefined,
      exequaturValidationToken,
    };

    let draftKey: string | undefined;
    try {
      draftKey = createMedicoDraftKey();
      await persistMedicoDraft(draftKey, draftPayload);
    } catch {
      draftKey = undefined;
    }

    navigation.navigate("RegistroCredencialesMedico", {
      datosPersonales: {
        ...draftPayload,
        fotoUrl: draftKey ? undefined : draftPayload.fotoUrl,
        draftKey,
      },
    });
  }, [isFormComplete, navigation, updateErrors, values]);

  const handleCancel = useCallback(() => {
    navigation.navigate("SeleccionPerfil");
  }, [navigation]);

  return {
    values,
    errors,
    modals,
    isLoading,
    isFormComplete,
    progressPercent,
    especialidadesFiltradas,
    countryCodeOptions: countryCodes,
    genderOptions: GENDER_OPTIONS,
    setNombreCompleto,
    setCedula,
    setBirthDate,
    setPhone,
    setEspecialidadQuery,
    openGenderModal,
    closeGenderModal,
    selectGender,
    openPrefixModal,
    closePrefixModal,
    selectCountryCode,
    openEspecialidadModal,
    closeEspecialidadModal,
    selectEspecialidad,
    pickImage,
    pickSupportingDocument,
    handleContinue,
    handleCancel,
  };
}
