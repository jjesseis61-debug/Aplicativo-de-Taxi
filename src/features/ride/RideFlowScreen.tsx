import { SafeAreaView } from 'react-native-safe-area-context';

import { rideService } from '../../services/rideService';
import { ErrorBanner, styles } from '../../ui/components';
import { CancelReasonScreen } from './screens/CancelReasonScreen';
import { ConfirmPickupScreen } from './screens/ConfirmPickupScreen';
import { DriverScreen } from './screens/DriverScreen';
import { EndedScreen } from './screens/EndedScreen';
import { PricingScreen } from './screens/PricingScreen';
import { RouteScreen } from './screens/RouteScreen';
import { SearchingScreen } from './screens/SearchingScreen';
import type { Flow } from './screens/types';
import { useRideFlow } from './useRideFlow';

function PhaseScreen({ flow }: { flow: Flow }) {
  switch (flow.state.phase) {
    case 'route':
      return <RouteScreen flow={flow} />;
    case 'pricing':
      return <PricingScreen flow={flow} />;
    case 'confirmPickup':
      return <ConfirmPickupScreen flow={flow} />;
    case 'searching':
      return <SearchingScreen flow={flow} />;
    case 'driverOnTheWay':
      return <DriverScreen flow={flow} />;
    case 'cancelReason':
      return <CancelReasonScreen flow={flow} />;
    case 'cancelled':
    case 'expired':
      return <EndedScreen flow={flow} />;
  }
}

export function RideFlowScreen() {
  const flow = useRideFlow(rideService);
  return (
    <SafeAreaView style={styles.screen}>
      {flow.state.error ? (
        <ErrorBanner message={flow.state.error} onDismiss={() => flow.dispatch({ type: 'errorDismissed' })} />
      ) : null}
      <PhaseScreen flow={flow} />
    </SafeAreaView>
  );
}
