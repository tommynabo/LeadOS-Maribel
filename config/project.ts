import { ProjectConfig } from '../lib/types';

export const PROJECT_CONFIG: ProjectConfig = {
    clientId: 'client_base_001',
    clientName: 'REGIST',
    primaryColor: 'hsl(142, 76%, 36%)',
    targets: {
        icp: 'CEOs, Founders, CTOs, Directivos, Tomadores de decisiones',
        locations: ['Madrid', 'Barcelona', 'Valencia'],
    },
    enabledPlatforms: ['linkedin'],
    searchSettings: {
        defaultDepth: 10,
        defaultMode: 'fast'
    }
};
