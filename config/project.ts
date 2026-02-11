import { ProjectConfig } from '../lib/types';

export const PROJECT_CONFIG: ProjectConfig = {
    clientId: 'client_base_001',
    clientName: 'LeadOS - Maribel',
    primaryColor: 'hsl(142, 76%, 36%)',
    targets: {
        icp: 'Mujeres directivas/gerentes, +40 años, buscando reinvención, marca personal, autoras/speakers',
        locations: ['Madrid', 'Barcelona', 'Valencia'],
    },
    enabledPlatforms: ['linkedin'],
    searchSettings: {
        defaultDepth: 10,
        defaultMode: 'fast'
    }
};
