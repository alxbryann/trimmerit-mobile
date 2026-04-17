import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, radii } from '../theme';
import LoyaltyCard from '../components/LoyaltyCard';

const BENEFICIO_TIPOS = [
  { key: 'corte_gratis', label: 'Corte gratis', icon: 'cut' },
  { key: 'descuento', label: 'Descuento', icon: 'pricetag' },
  { key: 'producto', label: 'Producto', icon: 'gift' },
  { key: 'personalizado', label: 'Personalizado', icon: 'star' },
];

export default function LoyaltyConfigScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barberoId, setBarberoId] = useState(null);
  const [nombreBarberia, setNombreBarberia] = useState('');
  const [programaId, setProgramaId] = useState(null);
  const [activo, setActivo] = useState(false);
  const [sellosRequeridos, setSellosRequeridos] = useState('10');
  const [beneficioTipo, setBeneficioTipo] = useState('personalizado');
  const [beneficioDesc, setBeneficioDesc] = useState('');
  const [clientesPendientes, setClientesPendientes] = useState([]);
  const [redeeming, setRedeeming] = useState(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigation.replace('Login'); return; }

    // Cargar datos del barbero
    const { data: barbero } = await supabase
      .from('barberos')
      .select('id, nombre_barberia, profiles(nombre)')
      .eq('id', user.id)
      .maybeSingle();

    if (!barbero) { setLoading(false); return; }

    setBarberoId(barbero.id);
    setNombreBarberia(barbero.nombre_barberia?.trim() || barbero.profiles?.nombre || 'Mi Barbería');

    // Cargar programa existente
    const { data: prog } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('barbero_id', barbero.id)
      .maybeSingle();

    if (prog) {
      setProgramaId(prog.id);
      setActivo(prog.activo);
      setSellosRequeridos(String(prog.sellos_requeridos));
      setBeneficioTipo(prog.beneficio_tipo);
      setBeneficioDesc(prog.beneficio_descripcion ?? '');
    }

    // Cargar clientes con beneficio listo para canjear
    await loadClientesPendientes(barbero.id, prog?.sellos_requeridos ?? 10);

    setLoading(false);
  }, [navigation]);

  const loadClientesPendientes = useCallback(async (bid, sellosReq) => {
    const { data } = await supabase
      .from('loyalty_cards')
      .select(`
        id,
        sellos_acumulados,
        cliente_id,
        profiles!loyalty_cards_cliente_id_fkey ( nombre, telefono )
      `)
      .eq('barbero_id', bid)
      .gte('sellos_acumulados', sellosReq)
      .is('canjeado_at', null);
    setClientesPendientes(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    const sellos = parseInt(sellosRequeridos, 10);
    if (!sellos || sellos < 2 || sellos > 50) {
      Alert.alert('Error', 'El número de cortes debe estar entre 2 y 50.');
      return;
    }
    if (!beneficioDesc.trim()) {
      Alert.alert('Error', 'Describí el beneficio que van a recibir los clientes.');
      return;
    }

    setSaving(true);
    const payload = {
      barbero_id: barberoId,
      sellos_requeridos: sellos,
      beneficio_tipo: beneficioTipo,
      beneficio_descripcion: beneficioDesc.trim(),
      activo,
    };

    let error;
    if (programaId) {
      ({ error } = await supabase
        .from('loyalty_programs')
        .update(payload)
        .eq('id', programaId));
    } else {
      const { data, error: e } = await supabase
        .from('loyalty_programs')
        .insert(payload)
        .select('id')
        .single();
      error = e;
      if (data?.id) setProgramaId(data.id);
    }

    setSaving(false);
    if (error) {
      Alert.alert('Error al guardar', error.message);
    } else {
      Alert.alert('Guardado', 'Programa de fidelización actualizado.');
    }
  }

  async function handleRedeem(card) {
    Alert.alert(
      'Canjear beneficio',
      `¿Confirmas que "${card.profiles?.nombre ?? 'este cliente'}" recibió el beneficio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar canje',
          onPress: async () => {
            setRedeeming(card.id);
            const { data, error } = await supabase.rpc('redeem_loyalty_card', {
              p_card_id: card.id,
            });
            setRedeeming(null);
            if (error || !data?.ok) {
              Alert.alert('Error', error?.message ?? data?.reason ?? 'No se pudo canjear.');
            } else {
              Alert.alert('¡Canjeado!', 'La tarjeta fue reiniciada. El cliente empieza un nuevo ciclo.');
              await loadClientesPendientes(barberoId, parseInt(sellosRequeridos, 10));
            }
          },
        },
      ]
    );
  }

  const sellosNum = parseInt(sellosRequeridos, 10) || 10;
  const previewDesc = beneficioDesc.trim() || '(escribe el beneficio)';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#141414', colors.black]} style={styles.headerGrad}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>PROGRAMA DE</Text>
            <Text style={styles.headerTitle}>FIDELIZACIÓN</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Toggle activar */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="ribbon" size={18} color={colors.acid} />
              <View>
                <Text style={styles.cardTitle}>Programa activo</Text>
                <Text style={styles.cardSubtitle}>Los clientes acumulan sellos al completar cortes</Text>
              </View>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              trackColor={{ false: colors.gray, true: colors.acidDim }}
              thumbColor={activo ? colors.acid : colors.grayLight}
            />
          </View>
        </View>

        {/* Configuración */}
        <Text style={styles.sectionLabel}>CONFIGURACIÓN</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>CORTES PARA COMPLETAR LA TARJETA</Text>
          <TextInput
            style={styles.input}
            value={sellosRequeridos}
            onChangeText={setSellosRequeridos}
            keyboardType="number-pad"
            maxLength={2}
            placeholderTextColor={colors.grayMid}
            placeholder="10"
          />
          <Text style={styles.fieldHint}>Entre 2 y 50 cortes</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>TIPO DE BENEFICIO</Text>
          <View style={styles.tiposGrid}>
            {BENEFICIO_TIPOS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tipoBtn, beneficioTipo === t.key && styles.tipoBtnActive]}
                onPress={() => setBeneficioTipo(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={beneficioTipo === t.key ? colors.black : colors.grayLight}
                />
                <Text style={[styles.tipoBtnText, beneficioTipo === t.key && styles.tipoBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>DESCRIPCIÓN DEL BENEFICIO</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={beneficioDesc}
            onChangeText={setBeneficioDesc}
            multiline
            numberOfLines={3}
            placeholder="Ej: Un corte gratis a elección"
            placeholderTextColor={colors.grayMid}
          />
          <Text style={styles.fieldHint}>Esto es lo que el cliente verá en su tarjeta</Text>
        </View>

        {/* Preview */}
        <Text style={styles.sectionLabel}>VISTA PREVIA</Text>
        <LoyaltyCard
          nombreBarberia={nombreBarberia}
          sellosAcumulados={Math.floor(sellosNum * 0.6)}
          sellosRequeridos={sellosNum}
          beneficioDesc={previewDesc}
          completada={false}
        />

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.black} />
            : <Text style={styles.saveBtnText}>GUARDAR PROGRAMA</Text>
          }
        </TouchableOpacity>

        {/* Clientes listos para canjear */}
        {clientesPendientes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>BENEFICIOS LISTOS PARA CANJEAR</Text>
            <Text style={styles.sectionSubtitle}>
              Estos clientes completaron su tarjeta y esperan el beneficio.
            </Text>
            {clientesPendientes.map((card) => (
              <View key={card.id} style={styles.clientCard}>
                <View style={styles.clientInfo}>
                  <View style={styles.clientAvatar}>
                    <Ionicons name="person" size={16} color={colors.grayLight} />
                  </View>
                  <View>
                    <Text style={styles.clientNombre}>
                      {card.profiles?.nombre ?? 'Cliente'}
                    </Text>
                    {card.profiles?.telefono ? (
                      <Text style={styles.clientTel}>{card.profiles.telefono}</Text>
                    ) : null}
                    <Text style={styles.clientSellos}>
                      {card.sellos_acumulados} sellos acumulados
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.redeemBtn, redeeming === card.id && styles.redeemBtnDisabled]}
                  onPress={() => handleRedeem(card)}
                  disabled={redeeming === card.id}
                >
                  {redeeming === card.id
                    ? <ActivityIndicator size="small" color={colors.black} />
                    : <Text style={styles.redeemBtnText}>CANJEAR</Text>
                  }
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  headerGrad: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  headerLabel: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 2.5, color: colors.acid },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.white, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 12 },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2.5,
    color: colors.grayLight,
    marginTop: 8,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.grayMid,
    marginBottom: 4,
    marginTop: -4,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  cardSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight, marginTop: 1 },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.grayLight,
  },
  fieldHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grayMid },
  input: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.white,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  tiposGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark3,
  },
  tipoBtnActive: { backgroundColor: colors.acid, borderColor: colors.acid },
  tipoBtnText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grayLight },
  tipoBtnTextActive: { color: colors.black },
  saveBtn: {
    backgroundColor: colors.acid,
    borderRadius: radii.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 2.5, color: colors.black },
  clientCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.acid,
    borderRadius: radii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientNombre: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  clientTel: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight },
  clientSellos: { fontFamily: fonts.body, fontSize: 11, color: colors.acid, marginTop: 1 },
  redeemBtn: {
    backgroundColor: colors.acid,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 80,
  },
  redeemBtnDisabled: { opacity: 0.6 },
  redeemBtnText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.5, color: colors.black },
});
