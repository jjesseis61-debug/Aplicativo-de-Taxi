import type { Place } from './types';

// Dados de exemplo até haver geolocalização e pesquisa de endereços reais.
export const CURRENT_LOCATION: Place = {
  id: 'current',
  label: 'A sua localização actual',
  address: '56CQ+6GQ, Av. Cmte. Gika, Luanda',
  lat: -8.8284,
  lng: 13.2389,
};

export const SAVED_PLACES: Place[] = [
  {
    id: 'hospital-500-casas',
    label: 'Hospital das 500 casas – Viana',
    address: '396G+435, Luanda',
    lat: -8.9068,
    lng: 13.3618,
  },
  {
    id: 'bombeiros-viana',
    label: 'Corpo de Bombeiros de Viana',
    address: '39X9+55R, Luanda',
    lat: -8.9022,
    lng: 13.3683,
  },
  {
    id: 'rua-da-sagres',
    label: 'Rua da Sagres',
    address: 'Zango II, Luanda',
    lat: -8.9619,
    lng: 13.4302,
  },
  {
    id: 'rocha-monteiro',
    label: 'Rocha Monteiro Missão',
    address: 'R. da Missão nº 33, Luanda',
    lat: -8.8172,
    lng: 13.2343,
  },
];
