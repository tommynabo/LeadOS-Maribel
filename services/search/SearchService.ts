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
    // GMAIL SEARCH - Ultra completo
    // ═══════════════════════════════════════════════════════════════════════════
    private async searchGmail(
        config: SearchConfigState,
        interpreted: { searchQuery: string; industry: string; targetRoles: string[]; location: string },
        exclusionSet: Set<string>,
        onLog: LogCallback,
        onComplete: ResultCallback
    ) {
        const query = `${interpreted.searchQuery} ${interpreted.location}`;
        onLog(`[GMAIL] 🗺️ Buscando: "${query}" (Estrategia de Volumen)`);

        // STAGE 1: Google Maps scraping (Over-fetch significantly to filter later)
        const targetCount = config.maxResults || 10;
        const fetchAmount = Math.max(targetCount * 5, 50); // Get at least 50 or 5x target

        const mapsResults = await this.callApifyActor(GOOGLE_MAPS_SCRAPER, {
            searchStringsArray: [query],
            maxCrawledPlacesPerSearch: fetchAmount,
            language: 'es',
            includeWebsiteEmail: true, // Ask Maps to try its best
            scrapeContacts: true,
            maxImages: 0,
            maxReviews: 0,
        }, onLog);

        onLog(`[GMAIL] 📊 ${mapsResults.length} empresas encontradas. Filtrando vacíos...`);

        // Convert to leads
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

            allLeads.push({
                id: String(item.placeId || `lead-${Date.now()}-${allLeads.length}`),
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
            onLog(`[ANTI-DUPLICADOS] 🛡️ Se han descartado ${duplicatesCount} leads que ya existían en tu base de datos.`);
        }

        // STAGE 2: Aggressive Contact Enrichment
        // We need to process leads that HAVE a website but NO email
        const needEmail = allLeads.filter(l => !l.decisionMaker?.email && l.website);
        const alreadyHasEmail = allLeads.filter(l => l.decisionMaker?.email);

        onLog(`[GMAIL] ℹ️ Estado actual: ${alreadyHasEmail.length} con email / ${needEmail.length} requieren deep scraping.`);

        if (needEmail.length > 0 && this.isRunning) {
            // Process in batches to avoid timeouts but maximize throughput
            const BATCH_SIZE = 10;
            const batches = Math.ceil(needEmail.length / BATCH_SIZE);

            onLog(`[GMAIL] 🚀 Iniciando extracción masiva de emails en ${needEmail.length} webs...`);

            for (let i = 0; i < batches && this.isRunning; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const batch = needEmail.slice(start, end);

                onLog(`[GMAIL] 📥 Procesando lote ${i + 1}/${batches} (${batch.length} webs)...`);

                try {
                    const contactResults = await this.callApifyActor(CONTACT_SCRAPER, {
                        startUrls: batch.map(l => ({ url: `https://${l.website}` })),
                        maxRequestsPerWebsite: 3, // Fast check
                        sameDomainOnly: true,
                        maxCrawlingDepth: 1, // Only check homepage and contact page usually
                    }, (msg) => { }); // Silent logs for sub-process to avoid spam

                    // Map results back to leads
                    for (const contact of contactResults) {
                        const contactUrl = contact.url || '';
                        // Find matching lead by domain
                        const match = batch.find(l => {
                            if (!l.website) return false;
                            return contactUrl.includes(l.website.replace('www.', ''));
                        });

                        if (match && contact.emails?.length) {
                            // Use Set to deduplicate and ignore trash emails like 'wix', 'sentry', etc.
                            const validEmails = contact.emails.filter((e: string) =>
                                !e.includes('sentry') && !e.includes('noreply') && !e.includes('wix') && e.includes('@')
                            );

                            if (validEmails.length > 0) {
                                match.decisionMaker.email = validEmails[0];
                                onLog(`[GMAIL] 📧 Email encontrado para ${match.companyName}: ${validEmails[0]}`);
                            }
                        }
                    }
                } catch (e: any) {
                    onLog(`[GMAIL] ⚠️ Fallo en lote ${i + 1}: ${e.message}`);
                }

                // If we have enough leads now, maybe stop? For now, let's just go through.
                const currentTotal = allLeads.filter(l => l.decisionMaker?.email).length;
                if (currentTotal >= targetCount) {
                    onLog(`[GMAIL] ✅ Objetivo de leads alcanzado (${currentTotal}). Deteniendo scraping.`);
                    break;
                }
            }
        }

        // ⚡ FILTER FINAL: ONLY leads with email
        const finalCandidates = allLeads.filter(l => l.decisionMaker?.email);

        if (finalCandidates.length === 0) {
            onLog(`[ERROR] ❌ CRÍTICO: No se encontraron emails válidos tras el scraping profundo.`);
            onLog(`[HINT] Intenta buscar un sector más digitalizado o aumenta el área de búsqueda.`);
            onComplete([]);
            return;
        }

        // Limit to requested amount
        const finalLeads = finalCandidates.slice(0, targetCount);

        onLog(`[GMAIL] 💎 Generando Icebreakers para ${finalLeads.length} leads validados...`);

        // STAGE 3: Quick AI analysis (Icebreakers only for speed/volume)
        if (this.openaiKey && this.isRunning) {
            for (let i = 0; i < finalLeads.length && this.isRunning; i++) {
                const lead = finalLeads[i];
                // Lighter analysis for volume
                lead.aiAnalysis.generatedIcebreaker = `Hola, he visto vuestra web ${lead.website} y me encaja mucho para...`;
                lead.status = 'ready';

                // Only do full deep research if it's a small batch (<20), otherwise just simple icebreaker
                if (finalLeads.length <= 20) {
                    const research = await this.deepResearchLead(lead, (m) => { });
                    const analysis = await this.generateUltraAnalysis(lead, research);
                    lead.aiAnalysis.fullAnalysis = analysis.fullAnalysis;
                    lead.aiAnalysis.psychologicalProfile = analysis.psychologicalProfile;
                    lead.aiAnalysis.businessMoment = analysis.businessMoment;
                    lead.aiAnalysis.salesAngle = analysis.salesAngle;
                    lead.aiAnalysis.fullMessage = analysis.personalizedMessage;
                    lead.aiAnalysis.generatedIcebreaker = analysis.bottleneck;
                } else {
                    // Fast path
                    lead.aiAnalysis.fullMessage = `Hola, vi vuestro negocio en ${lead.location}...`;
                    lead.aiAnalysis.summary = "Lead cualificado por volumen";
                    lead.aiAnalysis.psychologicalProfile = "N/A (Modo Volumen)";
                    lead.aiAnalysis.businessMoment = "Operativo";
                    lead.aiAnalysis.salesAngle = "Eficiencia/Escala";
                }
            }
        }

        onLog(`[GMAIL] 🏁 PROCESO FINALIZADO: ${finalLeads.length} leads ultra-cualificados con email`);
        onComplete(finalLeads);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LINKEDIN SEARCH - DEEP RESEARCH + PSYCHOLOGY
    // ═══════════════════════════════════════════════════════════════════════════
    private async searchLinkedIn(
        config: SearchConfigState,
        interpreted: { searchQuery: string; industry: string; targetRoles: string[]; location: string },
        exclusionSet: Set<string>,
        onLog: LogCallback,
        onComplete: ResultCallback
    ) {
        // 1. ACTIVE SEARCH (Búsqueda Activa - Women Leadership & Reinvention Focus)
        // Ensure we prioritize female terms if possible, though LinkedIn roles are often neutral or mixed.
        // We add keywords for the specific "Reinvention/Author/Speaker" angle.
        const roleTerms = interpreted.targetRoles.slice(0, 3).join(' OR ');
        const intentKeywords = '"marca personal" OR "reinvención" OR "conferenciante" OR "speaker" OR "autora" OR "mentora" OR "liderazgo femenino"';

        const activeQuery = `site:linkedin.com/in (${roleTerms}) (${intentKeywords}) "${interpreted.location}"`;

        const targetCount = config.maxResults || 5;
        const bufferMultiplier = 4;
        const fetchAmount = Math.max(targetCount * bufferMultiplier, 20); // At least 20

        onLog(`[LINKEDIN] 🕵️‍♂️ Iniciando BÚSQUEDA ACTIVA`);
        onLog(`[LINKEDIN] 🎯 Objetivo: ${targetCount} leads — Buscando x${bufferMultiplier} buffer (${fetchAmount} perfiles) para asegurar filtrado.`);
        onLog(`[LINKEDIN] 🎯 Query: ${activeQuery}`);

        try {
            // STEP 1: Discovery via Google (x4 buffer)
            const searchResults = await this.callApifyActor(GOOGLE_SEARCH_SCRAPER, {
                queries: activeQuery,
                maxPagesPerQuery: 3,
                resultsPerPage: fetchAmount,
                languageCode: 'es',
                countryCode: 'es',
            }, onLog);

            let allResults: any[] = [];
            for (const result of searchResults) {
                if (result.organicResults) allResults = allResults.concat(result.organicResults);
            }

            onLog(`[DEBUG] 🔍 Total Google Organic Results: ${allResults.length}`);

            const linkedInProfiles = allResults.filter((r: any) => r.url?.includes('linkedin.com/in/'));
            onLog(`[LINKEDIN] 📋 ${linkedInProfiles.length} perfiles detectados.`);

            if (linkedInProfiles.length > 0) {
                onLog(`[DEBUG] First profile found: ${linkedInProfiles[0].title} - ${linkedInProfiles[0].url}`);
            }

            if (!this.isRunning || linkedInProfiles.length === 0) {
                onLog(`[LINKEDIN] ❌ No se encontraron perfiles. Intenta ampliar la zona.`);
                onComplete([]);
                return;
            }

            // STEP 2: Deep Analysis (Posts + Psych Profile)
            // Process candidates one by one until we hit the target count
            const finalLeads: Lead[] = [];

            // Actor for posts
            const POSTS_SCRAPER = 'LQQIXN9Othf8f7R5n'; // apimaestro/linkedin-profile-posts

            // Iterate through ALL found profiles, not just the first N
            for (let i = 0; i < linkedInProfiles.length && this.isRunning; i++) {
                const profile = linkedInProfiles[i];

                // Check if we have reached the target
                if (finalLeads.length >= targetCount) {
                    onLog(`[LINKEDIN] ✅ Objetivo alcanzado (${finalLeads.length} leads). Deteniendo análisis.`);
                    break;
                }

                // 🛑 ANTI-DUPLICATE CHECK
                const tempCompany = this.extractCompany(profile.title) || 'Empresa Desconocida';
                const tempUrl = profile.url;

                if (this.isDuplicate(tempCompany, tempUrl, exclusionSet)) {
                    onLog(`[ANTI-DUPLICADOS] 🛡️ Saltando ${profile.title.substring(0, 20)}... (Ya existe)`);
                    continue;
                }

                onLog(`[RESEARCH] 🧠 Analizando candidato ${i + 1}/${linkedInProfiles.length}: ${profile.title.split(' - ')[0]}...`);

                // Parse Basic Info
                const titleParts = (profile.title || '').split(' - ');
                const name = titleParts[0]?.replace(' | LinkedIn', '').trim() || 'Usuario LinkedIn';
                const role = this.extractRole(profile.title) || 'Decisor';
                const company = this.extractCompany(profile.title) || 'Empresa Desconocida';

                // STEP 3: Scrape Recent Posts
                let recentPostsText = "";

                try {
                    onLog(`[RESEARCH] 📲 Obteniendo actividad reciente (Posts)...`);
                    const postsData = await this.callApifyActor(POSTS_SCRAPER, {
                        username: profile.url,
                        limit: 3 // Analyze last 3 posts
                    }, () => { }); // Silent

                    if (postsData && postsData.length > 0) {
                        recentPostsText = postsData.map((p: any) => `POST (${p.date || 'Reciente'}): ${p.text?.substring(0, 200)}...`).join('\n');
                        onLog(`[RESEARCH] ✅ ${postsData.length} posts recuperados para análisis.`);
                    } else {
                        onLog(`[RESEARCH] ⚠️ Sin actividad reciente accesible.`);
                    }
                } catch (e) {
                    onLog(`[RESEARCH] ⚠️ No se pudieron leer posts (Perfil privado o error).`);
                }

                // STEP 4: Psychological Analysis
                const researchDossier = `
                    PERFIL:
                    Nombre: ${name}
                    Headline: ${profile.title}
                    Snippet: ${profile.description}
                    URL: ${profile.url}
                    
                    ACTIVIDAD RECIENTE (Posts):
                    ${recentPostsText || "No hay posts recientes disponibles."}
                    `;

                const analysis = await this.generateUltraAnalysis({
                    companyName: company,
                    decisionMaker: { name, role, linkedin: profile.url }
                } as Lead, researchDossier);

                finalLeads.push({
                    id: `linkedin-psych-${Date.now()}-${i}`,
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
                        summary: `Perfil Psicológico: ${analysis.bottleneck}`,
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

                onLog(`[DEBUG] ✨ Added lead to final list: ${name}`);
            }

            onLog(`[LINKEDIN] 🏁 Proceso finalizado. ${finalLeads.length} leads analizados.`);
            onComplete(finalLeads);

        } catch (error: any) {
            onLog(`[LINKEDIN] ❌ Error: ${error.message}`);
            onComplete([]);
        }
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
