import PlaceholderScreen from './PlaceholderScreen';

export default function ClientesStatsScreen({ navigation, route }) {
  const scope = route?.params?.scope === 'barbero' ? 'barbero' : 'barberia';
  const subtitle = scope === 'barbero'
    ? 'Monitorea la retención de tu cartera personal.'
    : 'Monitorea la retención y actúa sobre los clientes en riesgo de abandono.';
  return (
    <PlaceholderScreen
      navigation={navigation}
      title="Análisis de Clientes"
      subtitle={subtitle}
      icon="person-circle"
    />
  );
}
