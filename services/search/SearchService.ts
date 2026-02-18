import { Lead, SearchConfigState } from '../../lib/types';

export type LogCallback = (message: string) => void;
export type ResultCallback = (leads: Lead[]) => void;

// Apify Actor IDs
// Apify Actor IDs
const GOOGLE_MAPS_SCRAPER = 'nwua9Gu5YrADL7ZDj';
const CONTACT_SCRAPER = 'vdrmO1lXCkhbPjE9j';
const GOOGLE_SEARCH_SCRAPER = 'nFJndFXA5zjCTuudP'; // ID for apify/google-search-scraper

export class SearchService {
    private isRunning = false;
    private apiKey: string = '';
    private openaiKey: string = '';

    public stop() {
        this.isRunning = false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SMART QUERY INTERPRETER
    // ═══════════════════════════════════════════════════════════════════════════
    private async interpretQuery(userQuery: string, platform: 'gmail' | 'linkedin'): Promise<{
        searchQuery: string;
        industry: string;
        targetRoles: string[];
        location: string;
    }> {
        if (!this.openaiKey) {
            return {
                searchQuery: userQuery,
                industry: userQuery,
                targetRoles: ['CEO', 'Fundador', 'Propietario', 'Director General'],
                location: 'España'
            };
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `Eres un experto en prospección B2B y Marca Personal. Interpreta la búsqueda para encontrar MUJERES DIRECTIVAS (+40 años) interesadas en REINVENCIÓN PROFESIONAL, MARCA PERSONAL o ser AUTORAS/SPEAKERS.

Responde SOLO con JSON:
{
  "searchQuery": "término optimizado para encontrar este perfil",
  "industry": "sector detectado",
  "targetRoles": ["CEO", "Fundadora", "Directora", "Autora", "Speaker"],
  "location": "ubicación o España"
}`
                        },
                        { role: 'user', content: `Búsqueda: "${userQuery}"` }
                    ],
                    temperature: 0.3,
                    max_tokens: 150
                })
            });
            const data = await response.json();
            const match = data.choices?.[0]?.message?.content?.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
        } catch (e) { console.error(e); }

        return { searchQuery: userQuery, industry: userQuery, targetRoles: ['CEO', 'Fundadora', 'Directora', 'Autora', 'Speaker'], location: 'España' };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED FILTERS PROCESSOR
    // ═══════════════════════════════════════════════════════════════════════════
    private buildQueryWithAdvancedFilters(baseQuery: string, filters?: any): string {
        if (!filters || !Object.keys(filters).length) {
            return baseQuery;
        }

        const parts = [baseQuery];

        // Add locations to query
        if (filters.locations && filters.locations.length > 0) {
            parts.push(`(${filters.locations.map((loc: string) => `"${loc}"`).join(' OR ')})`);
        }

        // Add job titles to query
        if (filters.jobTitles && filters.jobTitles.length > 0) {
            parts.push(`(${filters.jobTitles.map((job: string) => `"${job}"`).join(' OR ')})`);
        }

        // Add industries to query
        if (filters.industries && filters.industries.length > 0) {
            parts.push(`(${filters.industries.map((ind: string) => `"${ind}"`).join(' OR ')})`);
        }

        // Add keywords to query
        if (filters.keywords && filters.keywords.length > 0) {
            parts.push(`(${filters.keywords.map((key: string) => `"${key}"`).join(' OR ')})`);
        }

        return parts.join(' AND ');
    }

    /**
     * Check if a lead matches advanced filter criteria
     */
    private leadMatchesFilters(lead: Lead, filters?: any): boolean {
        if (!filters) return true;

        try {
            // Check locations
            if (filters.locations && filters.locations.length > 0) {
                const leadLocation = (lead.location || '').toLowerCase();
                const matchesLocation = filters.locations.some((loc: string) =>
                    leadLocation.includes(loc.toLowerCase())
                );
                if (!matchesLocation) return false;
            }

            // Check company sizes (if available in lead data)
            if (filters.companySizes && filters.companySizes.length > 0) {
                // Company size usually comes from summary/analysis
                const summary = (lead.aiAnalysis?.summary || '').toLowerCase();
                const matchesSize = filters.companySizes.some((size: string) => {
                    if (size === 'startup') return summary.includes('1-50') || summary.includes('pequeña');
                    if (size === 'small') return summary.includes('1-100') || summary.includes('pequeña');
                    if (size === 'medium') return summary.includes('100-1000') || summary.includes('mediana');
                    if (size === 'large') return summary.includes('1000+') || summary.includes('grande');
                    return summary.includes(size);
                });
                if (!matchesSize && filters.companySizes.length > 0) return false;
            }

            return true;
        } catch (e) {
            return true; // If filtering fails, keep the lead
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEEP RESEARCH - Google Search for company/owner info
    // ═══════════════════════════════════════════════════════════════════════════
    private async deepResearchLead(lead: Lead, onLog: LogCallback): Promise<string> {
        if (!this.isRunning) return '';

        const searchQueries = [];

        // Research company
        if (lead.companyName && lead.companyName !== 'Sin Nombre') {
            searchQueries.push(`"${lead.companyName}" empresa valores misión`);
        }

        // Research owner if we have a name
        if (lead.decisionMaker?.name) {
            searchQueries.push(`"${lead.decisionMaker.name}" ${lead.companyName} entrevista`);
            searchQueries.push(`"${lead.decisionMaker.name}" linkedin`);
        }

        // Research from website
        if (lead.website) {
            searchQueries.push(`site:${lead.website} "sobre nosotros" OR "quiénes somos" OR "about"`);
        }

        if (searchQueries.length === 0) return '';

        try {
            const searchInput = {
                queries: searchQueries.join('\n'),
                maxPagesPerQuery: 1,
                resultsPerPage: 5,
                languageCode: 'es',
                countryCode: 'es',
            };

            const results = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, searchInput, (msg) => { }); // Silent

            let researchData = '';
            for (const result of results) {
                if (result.organicResults) {
                    for (const organic of result.organicResults.slice(0, 3)) {
                        researchData += `\n- ${organic.title}: ${organic.description || ''}`;
                    }
                }
            }

            return researchData;
        } catch (e) {
            return '';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ULTRA-COMPLETE AI ANALYSIS - Psychological + Business + Bottleneck
    // ═══════════════════════════════════════════════════════════════════════════
    private async generateUltraAnalysis(lead: Lead, researchData: string): Promise<{
        fullAnalysis: string;
        psychologicalProfile: string;
        businessMoment: string;
        salesAngle: string;
        personalizedMessage: string;
        bottleneck: string;
    }> {
        if (!this.openaiKey) {
            return {
                fullAnalysis: `${lead.companyName}: ${lead.aiAnalysis?.summary || ''}`,
                psychologicalProfile: 'Análisis no disponible (Sin API Key)',
                businessMoment: 'Desconocido',
                salesAngle: 'Genérico',
                personalizedMessage: '',
                bottleneck: ''
            };
        }

        const context = `
═══ DATOS DEL LEAD ═══
Empresa: ${lead.companyName}
Web: ${lead.website || 'No disponible'}
Ubicación: ${lead.location || 'España'}
Decisor: ${lead.decisionMaker?.name || 'No identificado'}
Cargo: ${lead.decisionMaker?.role || 'Propietario'}
Email: ${lead.decisionMaker?.email || 'No disponible'}
LinkedIn: ${lead.decisionMaker?.linkedin || 'No disponible'}
Resumen inicial: ${lead.aiAnalysis?.summary || ''}

═══ INVESTIGACIÓN ADICIONAL ═══
${researchData || 'Sin datos adicionales'}
        `.trim();

        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.openaiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: `Eres un GENIO del análisis de marca personal y psicología femenina directiva. Tu trabajo es analizar si este lead (MUJER DIRECTIVA/GERENTE) está en un momento de búsqueda de REINVENCIÓN, PROPÓSITO o POTENCIAR SU MARCA PERSONAL.

SI HAY DATOS DE "ACTIVIDAD RECIENTE (Posts)":
- Busca señales de: "Nuevo rumbo", "Reflexión personal", "Conferencias", "Libros", "Mentoring", "Cansancio corporativo".
- Analiza su tono: ¿Es inspiradora? ¿Vulnerable? ¿Autoritaria?

DEBES generar exactamente este JSON (sin markdown, solo JSON puro):
{
  "psychologicalProfile": "Describe su perfil y momento vital (Ej: 'Directiva consolidada buscando legado...' o 'En transición hacia speaker...')",
  "businessMoment": "Estado de su marca personal (Ej: 'Invisible', 'Emergente', 'Autoridad establecida')",
  "salesAngle": "El argumento EMOCIONAL para ofrecerle acompañamiento en su marca personal.",
  "bottleneck": "Su mayor bloqueo visible (Ej: 'Tiene historia pero no la cuenta', 'Inconsistencia', 'Marca anticuada').",
  "personalizedMessage": "Mensaje de 100 palabras. Tono CERCANO, EMPÁTICO y PROFESIONAL. Menciona su trayectoria o posts recientes."
}

IMPORTANTE: Responde SOLO con JSON válido.`
                            },
                            {
                                role: 'user',
                                content: `Analiza este lead (Intento ${attempt}):\n\n${context}`
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 1000
                    })
                });

                if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || '';
                const jsonMatch = content.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        fullAnalysis: `🧠 PERFIL: ${parsed.psychologicalProfile}\n🏢 MOMENTO: ${parsed.businessMoment}\n💡 ÁNGULO: ${parsed.salesAngle}`, // Legacy format for safety
                        psychologicalProfile: parsed.psychologicalProfile || 'No detectado',
                        businessMoment: parsed.businessMoment || 'No detectado',
                        salesAngle: parsed.salesAngle || 'Genérico',
                        personalizedMessage: parsed.personalizedMessage || `Hola ${lead.decisionMaker?.name || 'equipo'}, me gustaría contactar con vosotros.`,
                        bottleneck: parsed.bottleneck || 'Oportunidad de mejora detectada'
                    };
                }
            } catch (e) {
                console.error(`Attempt ${attempt} failed:`, e);
                if (attempt === MAX_RETRIES) break;
                await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
            }
        }

        // Fallback if all AI attempts fail
        return {
            fullAnalysis: `Análisis automático no disponible. Revisar perfil de ${lead.companyName}.`,
            psychologicalProfile: 'No disponible',
            businessMoment: 'Desconocido',
            salesAngle: 'Desconocido',
            personalizedMessage: `Hola ${lead.decisionMaker?.name || 'Responsable'}, he visto vuestra web ${lead.website} y me gustaría comentar una oportunidad de colaboración.`,
            bottleneck: 'Revisión manual requerida'
        };
    }

    private async callApifyActor(actorId: string, input: any, onLog: LogCallback): Promise<any[]> {
        // Use local proxy to avoid CORS
        const baseUrl = '/api/apify';
        const startUrl = `${baseUrl}/acts/${actorId}/runs?token=${this.apiKey}`;

        const startResponse = await fetch(startUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!startResponse.ok) {
            const err = await startResponse.text();
            throw new Error(`Error actor ${actorId}: ${err}`);
        }

        const startData = await startResponse.json();
        const runId = startData.data.id;
        const defaultDatasetId = startData.data.defaultDatasetId;

        onLog(`[APIFY] Actor iniciado`);

        let isFinished = false;
        let pollCount = 0;
        while (!isFinished && this.isRunning && pollCount < 60) {
            await new Promise(r => setTimeout(r, 5000));
            pollCount++;

            const statusRes = await fetch(`${baseUrl}/acts/${actorId}/runs/${runId}?token=${this.apiKey}`);
            const statusData = await statusRes.json();
            const status = statusData.data.status;

            if (pollCount % 4 === 0) onLog(`[APIFY] Estado: ${status}`);

            if (status === 'SUCCEEDED') isFinished = true;
            else if (status === 'FAILED' || status === 'ABORTED') throw new Error(`Actor falló: ${status}`);
        }

        if (!this.isRunning) return [];

        const itemsRes = await fetch(`${baseUrl}/datasets/${defaultDatasetId}/items?token=${this.apiKey}`);
        return await itemsRes.json();
    }

    public async startSearch(config: SearchConfigState, exclusionSet: Set<string>, onLog: LogCallback, onComplete: ResultCallback) {
        this.isRunning = true;

        try {
            this.apiKey = import.meta.env.VITE_APIFY_API_TOKEN || '';
            this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

            if (!this.apiKey) throw new Error("Falta VITE_APIFY_API_TOKEN en .env");

            onLog(`[IA] 🧠 Interpretando: "${config.query}"...`);
            const interpreted = await this.interpretQuery(config.query, config.source);
            onLog(`[IA] ✅ Industria: ${interpreted.industry}`);

            if (config.source === 'linkedin') {
                await this.searchLinkedIn(config, interpreted, exclusionSet, onLog, onComplete);
            } else {
                await this.searchGmail(config, interpreted, exclusionSet, onLog, onComplete);
            }

        } catch (error: any) {
            onLog(`[ERROR] ❌ ${error.message}`);
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GMAIL SEARCH - SMART LOOP WITH PAGINATION
    // ═══════════════════════════════════════════════════════════════════════════
    private async searchGmail(
        config: SearchConfigState,
        interpreted: { searchQuery: string; industry: string; targetRoles: string[]; location: string },
        exclusionSet: Set<string>,
        onLog: LogCallback,
        onComplete: ResultCallback
    ) {
        let query = `${interpreted.searchQuery} ${interpreted.location}`;
        
        // Apply advanced filters to query if available
        if (config.advancedFilters) {
            query = this.buildQueryWithAdvancedFilters(query, config.advancedFilters);
            onLog(`[FILTERS] ✅ Filtros avanzados aplicados a la búsqueda`);
        }
        
        onLog(`[GMAIL] 🗺️ Buscando: "${query}" (Smart Loop x4)...`);

        const targetCount = config.maxResults || 10;
        const validLeads: Lead[] = [];
        let attempts = 0;
        const MAX_ATTEMPTS = 10;
        let totalScannedPreviously = 0;

        // ═══════════════════════════════════════════════════════════════════════════
        // SMART LOOP: Keep iterating until target reached
        // ═══════════════════════════════════════════════════════════════════════════
        while (validLeads.length < targetCount && this.isRunning && attempts < MAX_ATTEMPTS) {
            attempts++;
            const needed = targetCount - validLeads.length;
            const fetchAmount = needed * 4; // Smart multiplier x4

            onLog(`[ATTEMPT ${attempts}] 🔄 Búsqueda: ${fetchAmount} candidatos (faltantes: ${needed})...`);

            // STAGE 1: Google Maps scraping with smart pagination
            const totalMapsToScan = fetchAmount + totalScannedPreviously;

            const mapsResults = await this.callApifyActor(GOOGLE_MAPS_SCRAPER, {
                searchStringsArray: [query],
                maxCrawledPlacesPerSearch: Math.min(totalMapsToScan, 1000),
                language: 'es',
                includeWebsiteEmail: true,
                scrapeContacts: true,
                maxImages: 0,
                maxReviews: 0,
            }, onLog);

            if (mapsResults.length === 0) {
                onLog(`[ATTEMPT ${attempts}] ⚠️ No se encontraron más resultados en Maps.`);
                break; // No more results
            }

            onLog(`[GMAIL] 📊 ${mapsResults.length} empresas encontradas (acumuladas: ${totalScannedPreviously})...`);

            // Update pagination tracker
            totalScannedPreviously += mapsResults.length;

            // Convert to leads and apply deduplication
            let allLeads: Lead[] = [];
            let duplicatesCount = 0;

            for (const item of mapsResults) {
                const tempLead = {
                    companyName: item.title || item.name || 'Sin Nombre',
                    website: item.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || ''
                };

                // 🛑 ANTI-DUPLICATE CHECK
                if (this.isDuplicate(tempLead.companyName, tempLead.website || '', exclusionSet)) {
                    duplicatesCount++;
                    continue; // Skip this one
                }

                // Also check session duplicates
                if (validLeads.some(v => v.website === tempLead.website || v.companyName === tempLead.companyName)) {
                    continue;
                }

                allLeads.push({
                    id: String(item.placeId || `lead-${Date.now()}-${attempts}-${allLeads.length}`),
                    source: 'gmail' as const,
                    companyName: tempLead.companyName,
                    website: tempLead.website,
                    location: item.address || item.fullAddress || '',
                    decisionMaker: {
                        name: '',
                        role: 'Propietario',
                        email: item.email || (item.emails?.[0]) || '',
                        phone: item.phone || (item.phones?.[0]) || '',
                        linkedin: '',
                        facebook: item.facebook || '',
                        instagram: item.instagram || '',
                    },
                    aiAnalysis: {
                        summary: `${item.categoryName || interpreted.industry} - ${item.reviewsCount || 0} reseñas (${item.totalScore || 'N/A'}⭐)`,
                        painPoints: [],
                        generatedIcebreaker: '',
                        fullMessage: '',
                        fullAnalysis: '',
                        psychologicalProfile: '',
                        businessMoment: '',
                        salesAngle: ''
                    },
                    status: 'scraped' as const
                });
            }

            if (duplicatesCount > 0) {
                onLog(`[ATTEMPT ${attempts}] 🛡️ Se han descartado ${duplicatesCount} duplicados.`);
            }

            if (allLeads.length === 0) {
                onLog(`[ATTEMPT ${attempts}] ⚠️ Todos descartados por duplicado.`);
                continue; // Try next attempt
            }

            onLog(`[ATTEMPT ${attempts}] ✨ ${allLeads.length} candidatos nuevos.`);

            // STAGE 2: Aggressive Contact Enrichment
            const needEmail = allLeads.filter(l => !l.decisionMaker?.email && l.website);
            const alreadyHasEmail = allLeads.filter(l => l.decisionMaker?.email);

            onLog(`[ATTEMPT ${attempts}] ℹ️ ${alreadyHasEmail.length} con email / ${needEmail.length} necesitan scraping...`);

            if (needEmail.length > 0 && this.isRunning) {
                const BATCH_SIZE = 10;
                const batches = Math.ceil(needEmail.length / BATCH_SIZE);

                for (let i = 0; i < batches && this.isRunning; i++) {
                    const start = i * BATCH_SIZE;
                    const end = start + BATCH_SIZE;
                    const batch = needEmail.slice(start, end);

                    try {
                        const contactResults = await this.callApifyActor(CONTACT_SCRAPER, {
                            startUrls: batch.map(l => ({ url: `https://${l.website}` })),
                            maxRequestsPerWebsite: 3,
                            sameDomainOnly: true,
                            maxCrawlingDepth: 1,
                        }, (msg) => { });

                        for (const contact of contactResults) {
                            const contactUrl = contact.url || '';
                            const match = batch.find(l => {
                                if (!l.website) return false;
                                return contactUrl.includes(l.website.replace('www.', ''));
                            });

                            if (match && contact.emails?.length) {
                                const validEmails = contact.emails.filter((e: string) =>
                                    !e.includes('sentry') && !e.includes('noreply') && !e.includes('wix') && e.includes('@')
                                );

                                if (validEmails.length > 0) {
                                    match.decisionMaker.email = validEmails[0];
                                    onLog(`[GMAIL] 📧 Email: ${validEmails[0]}`);
                                }
                            }
                        }
                    } catch (e: any) {
                        onLog(`[GMAIL] ⚠️ Lote ${i + 1} error: ${e.message}`);
                    }
                }
            }

            // Filter leads with email
            const finalCandidates = allLeads.filter(l => l.decisionMaker?.email);

            if (finalCandidates.length === 0) {
                onLog(`[ATTEMPT ${attempts}] ⚠️ Ninguno tiene email válido.`);
                continue; // Try next attempt
            }

            // Add successful leads to collection
            const slotsRemaining = targetCount - validLeads.length;
            const leadsToAdd = finalCandidates.slice(0, slotsRemaining);

            for (const lead of leadsToAdd) {
                validLeads.push(lead);
                onLog(`[SUCCESS] ✅ Lead ${validLeads.length}/${targetCount}: ${lead.companyName}`);
            }
        } // End Smart Loop

        if (validLeads.length === 0) {
            onLog(`[ERROR] ❌ No se encontraron emails válidos tras intentos múltiples.`);
            onLog(`[HINT] Intenta buscar un sector más digitalizado o aumenta el área de búsqueda.`);
            onComplete([]);
            return;
        }

        onLog(`[GMAIL] 📊 Búsqueda completada: ${validLeads.length}/${targetCount} en ${attempts} intentos...`);

        // STAGE 3: AI analysis if needed
        if (this.openaiKey && this.isRunning) {
            const leadsToAnalyze = validLeads.slice(0, targetCount);
            
            for (let i = 0; i < leadsToAnalyze.length && this.isRunning; i++) {
                const lead = leadsToAnalyze[i];
                lead.aiAnalysis.generatedIcebreaker = `Hola, he visto vuestra web ${lead.website}...`;
                lead.status = 'ready';

                if (leadsToAnalyze.length <= 20) {
                    try {
                        const research = await this.deepResearchLead(lead, (m) => { });
                        const analysis = await this.generateUltraAnalysis(lead, research);
                        lead.aiAnalysis.fullAnalysis = analysis.fullAnalysis;
                        lead.aiAnalysis.psychologicalProfile = analysis.psychologicalProfile;
                        lead.aiAnalysis.businessMoment = analysis.businessMoment;
                        lead.aiAnalysis.salesAngle = analysis.salesAngle;
                        lead.aiAnalysis.fullMessage = analysis.personalizedMessage;
                    } catch (e) {
                        lead.aiAnalysis.fullMessage = `Contacto disponible en ${lead.website}`;
                    }
                }
            }
        }

        onLog(`[GMAIL] 🏁 FINALIZADO: ${validLeads.length} leads listos`);
        onComplete(validLeads);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LINKEDIN SEARCH - SMART LOOP WITH PAGINATION
    // ═══════════════════════════════════════════════════════════════════════════
    private async searchLinkedIn(
        config: SearchConfigState,
        interpreted: { searchQuery: string; industry: string; targetRoles: string[]; location: string },
        exclusionSet: Set<string>,
        onLog: LogCallback,
        onComplete: ResultCallback
    ) {
        const targetCount = config.maxResults || 5;
        const validLeads: Lead[] = [];
        let attempts = 0;
        const MAX_ATTEMPTS = 10;
        let currentPage = 1;

        // Women Leadership & Reinvention Focus
        const intentKeywords = '"marca personal" OR "reinvención" OR "conferenciante" OR "speaker" OR "autora" OR "mentora" OR "liderazgo femenino"';

        onLog(`[LINKEDIN] 🕵️‍♂️ Iniciando BÚSQUEDA ACTIVA con Smart Loop...`);
        onLog(`[LINKEDIN] 🎯 Objetivo: ${targetCount} líderes mujeres interesadas en reinvención profesional`);

        // ═══════════════════════════════════════════════════════════════════════════
        // SMART LOOP: Paginate through results
        // ═══════════════════════════════════════════════════════════════════════════
        while (validLeads.length < targetCount && this.isRunning && attempts < MAX_ATTEMPTS) {
            attempts++;
            const needed = targetCount - validLeads.length;
            const resultsToFetch = needed * 4; // x4 multiplier

            onLog(`[LINKEDIN-ATTEMPT ${attempts}] 🔄 Página ${currentPage}: ${resultsToFetch} resultados...`);

            const roleTerms = interpreted.targetRoles.slice(0, 3).join(' OR ');
            const activeQuery = `site:linkedin.com/in (${roleTerms}) (${intentKeywords}) "${interpreted.location}"`;

            try {
                const searchResults = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, {
                    queries: activeQuery,
                    maxPagesPerQuery: currentPage,
                    resultsPerPage: resultsToFetch,
                    languageCode: 'es',
                    countryCode: 'es',
                }, onLog);

                let allResults: any[] = [];
                for (const result of searchResults) {
                    if (result.organicResults) allResults = allResults.concat(result.organicResults);
                }

                if (allResults.length === 0) {
                    onLog(`[LINKEDIN-ATTEMPT ${attempts}] ⚠️ No hay más resultados en página ${currentPage}.`);
                    break;
                }

                let linkedInProfiles = allResults.filter((r: any) => r.url?.includes('linkedin.com/in/'));
                onLog(`[DEBUG] 👤 Perfiles encontrados: ${linkedInProfiles.length}`);

                if (linkedInProfiles.length === 0) {
                    onLog(`[LINKEDIN-ATTEMPT ${attempts}] ⚠️ Sin perfiles en esta página.`);
                    break;
                }

                // Process profiles
                const POSTS_SCRAPER = 'LQQIXN9Othf8f7R5n';

                for (let i = 0; i < linkedInProfiles.length && this.isRunning; i++) {
                    if (validLeads.length >= targetCount) break;

                    const profile = linkedInProfiles[i];
                    onLog(`[RESEARCH] 🧠 Analizando: ${profile.title.split(' - ')[0]}...`);

                    const titleParts = (profile.title || '').split(' - ');
                    const name = titleParts[0]?.replace(' | LinkedIn', '').trim() || 'Usuario LinkedIn';
                    const role = this.extractRole(profile.title) || 'Lidereza';
                    const company = this.extractCompany(profile.title) || 'Empresa Desconocida';

                    // 🛑 ANTI-DUPLICATE CHECK
                    const tempUrl = profile.url;
                    if (this.isDuplicate(company, tempUrl, exclusionSet)) {
                        onLog(`[ANTI-DUPLICADOS] 🛡️ Saltando duplicado: ${profile.title.substring(0, 30)}...`);
                        continue;
                    }

                    // Check session duplicates
                    if (validLeads.some(l => l.companyName === company)) {
                        continue;
                    }

                    let recentPostsText = "";
                    try {
                        const postsData = await this.callApifyActor(POSTS_SCRAPER, {
                            username: profile.url,
                            limit: 3
                        }, () => { });

                        if (postsData && postsData.length > 0) {
                            recentPostsText = postsData.map((p: any) => `${p.text?.substring(0, 150)}...`).join('\n');
                        }
                    } catch (e) {
                        // Silent - posts are optional
                    }

                    const researchDossier = `PERFIL: ${name}\nHeadline: ${profile.title}\nReciente: ${recentPostsText || "N/A"}\nSnippet: ${profile.description || ''}`;

                    try {
                        const analysis = await this.generateUltraAnalysis({
                            companyName: company,
                            decisionMaker: { name, role, linkedin: profile.url }
                        } as Lead, researchDossier);

                        validLeads.push({
                            id: `linkedin-${Date.now()}-${validLeads.length}`,
                            source: 'linkedin',
                            companyName: company,
                            website: '',
                            location: interpreted.location,
                            decisionMaker: {
                                name,
                                role,
                                email: '',
                                phone: '',
                                linkedin: profile.url
                            },
                            aiAnalysis: {
                                summary: `Psicología: ${analysis.bottleneck}`,
                                fullAnalysis: analysis.fullAnalysis,
                                psychologicalProfile: analysis.psychologicalProfile,
                                businessMoment: analysis.businessMoment,
                                salesAngle: analysis.salesAngle,
                                fullMessage: analysis.personalizedMessage,
                                generatedIcebreaker: analysis.bottleneck,
                                painPoints: []
                            },
                            status: 'ready'
                        });

                        onLog(`[SUCCESS] ✅ Lead ${validLeads.length}/${targetCount}: ${name}`);
                    } catch (e) {
                        onLog(`[RESEARCH] ⚠️ Análisis fallido para ${name}`);
                    }
                }

                currentPage++;

            } catch (error: any) {
                onLog(`[LINKEDIN-ATTEMPT ${attempts}] ❌ Error: ${error.message}`);
                break;
            }
        } // End Smart Loop

        onLog(`[LINKEDIN] 🏁 Búsqueda completada: ${validLeads.length}/${targetCount} leads en ${attempts} intentos`);
        onComplete(validLeads);
    }

    private extractCompany(text: string): string {
        // Heuristic: "CEO en [Empresa]" or "CEO at [Company]"
        const atMatch = text.match(/\b(en|at|@)\s+([^|\-.,]+)/i);
        if (atMatch && atMatch[2]) return atMatch[2].trim();
        return '';
    }

    private extractRole(text: string): string {
        const lower = text.toLowerCase();
        if (lower.includes('ceo')) return 'CEO';
        if (lower.includes('founder') || lower.includes('fundador')) return 'Fundador';
        if (lower.includes('owner') || lower.includes('propietario')) return 'Propietario';
        if (lower.includes('director')) return 'Director';
        return '';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ANTI-DUPLICATE CHECK - Clean & Normalize
    // ═══════════════════════════════════════════════════════════════════════════
    private cleanUrl(url: string): string {
        if (!url) return '';
        return url
            .toLowerCase()
            .replace(/^https?:\/\//, '')      // Remove protocol
            .replace(/^www\./, '')             // Remove www
            .replace(/\/$/, '')                // Remove trailing slash
            .trim();
    }

    private isDuplicate(companyName: string, websiteOrUrl: string, exclusionSet: Set<string>): boolean {
        // Check by company name (normalized)
        const normalizedCompany = companyName.toLowerCase().trim();
        if (exclusionSet.has(normalizedCompany)) {
            return true;
        }

        // Check by website/URL (normalized)
        const cleanedUrl = this.cleanUrl(websiteOrUrl);
        if (cleanedUrl && exclusionSet.has(cleanedUrl)) {
            return true;
        }

        // Check all variations in the Set to catch partial matches
        for (const excluded of exclusionSet) {
            // If both are URLs, compare cleaned versions
            if (excluded.includes('.') && cleanedUrl.includes('.')) {
                if (cleanedUrl === excluded || excluded === cleanedUrl) {
                    return true;
                }
            }
            // If both are company names, exact match comparison
            if (normalizedCompany === excluded) {
                return true;
            }
        }

        return false;
    }
}

export const searchService = new SearchService();
