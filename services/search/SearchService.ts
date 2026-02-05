// import { ApifyClient } from 'apify-client'; // Removed strictly Node.js dependency
import { Lead, SearchConfigState } from '../../lib/types';

export type LogCallback = (message: string) => void;
export type ResultCallback = (leads: Lead[]) => void;

// Apify Actor IDs
const GOOGLE_MAPS_SCRAPER = 'nwua9Gu5YrADL7ZDj'; // Google Maps Scraper with Emails
const CONTACT_SCRAPER = 'vdrmO1lXCkhbPjE9j'; // Contact Info Scraper
const DECISION_MAKER_FINDER = 'curious_coder/decision-maker-email-extractor';

export class SearchService {
    private isRunning = false;
    private apiKey: string = '';

    public stop() {
        this.isRunning = false;
    }

    private async callApifyActor(actorId: string, input: any, onLog: LogCallback): Promise<any[]> {
        const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${this.apiKey}`;

        const startResponse = await fetch(startUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!startResponse.ok) {
            const err = await startResponse.text();
            throw new Error(`Error iniciando actor ${actorId}: ${err}`);
        }

        const startData = await startResponse.json();
        const runId = startData.data.id;
        const defaultDatasetId = startData.data.defaultDatasetId;

        onLog(`[APIFY] Actor ${actorId} iniciado (Run: ${runId})`);

        // Poll for completion
        let isFinished = false;
        while (!isFinished && this.isRunning) {
            await new Promise(r => setTimeout(r, 5000));

            const statusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${this.apiKey}`;
            const statusRes = await fetch(statusUrl);
            const statusData = await statusRes.json();
            const status = statusData.data.status;

            onLog(`[APIFY] Estado: ${status}`);

            if (status === 'SUCCEEDED') {
                isFinished = true;
            } else if (status === 'FAILED' || status === 'ABORTED') {
                throw new Error(`Actor ${actorId} falló: ${status}`);
            }
        }

        if (!this.isRunning) return [];

        // Fetch results
        const itemsUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${this.apiKey}`;
        const itemsRes = await fetch(itemsUrl);
        return await itemsRes.json();
    }

    public async startSearch(
        config: SearchConfigState,
        onLog: LogCallback,
        onComplete: ResultCallback
    ) {
        this.isRunning = true;
        const leads: Lead[] = [];

        try {
            this.apiKey = import.meta.env.VITE_APIFY_API_TOKEN || import.meta.env.VITE_APIFY_API_KEY || '';

            if (!this.apiKey) {
                throw new Error("Falta la API Key de Apify. Configura VITE_APIFY_API_TOKEN en tu .env");
            }

            // ═══════════════════════════════════════════════════════════════════
            // STAGE 1: Google Maps Scraper with Emails
            // ═══════════════════════════════════════════════════════════════════
            const query = `${config.query} en España`;
            onLog(`[STAGE 1] 🗺️ Iniciando Google Maps Scraper para: "${query}"`);

            const mapsInput = {
                searchStringsArray: [query],
                maxCrawledPlacesPerSearch: config.maxResults || 20,
                language: 'es',
                includeWebsiteEmail: true,
                scrapeContacts: true,
                maxImages: 0,
                maxReviews: 0,
            };

            const mapsResults = await this.callApifyActor(GOOGLE_MAPS_SCRAPER, mapsInput, onLog);
            onLog(`[STAGE 1] ✅ Obtenidos ${mapsResults.length} resultados de Google Maps`);

            if (!this.isRunning) return;

            // Process Google Maps results into basic leads
            const basicLeads: Lead[] = mapsResults.map((item: any, index: number) => ({
                id: String(item.placeId || `lead-${Date.now()}-${index}`),
                source: 'gmaps' as const,
                companyName: item.title || item.name || 'Sin Nombre',
                website: item.website?.replace(/^https?:\/\//, '').replace(/\/$/, ''),
                location: item.address || item.fullAddress,
                decisionMaker: {
                    name: '',
                    role: '',
                    email: item.email || (item.emails?.[0]) || '',
                    phone: item.phone || (item.phones?.[0]) || '',
                    linkedin: '',
                    facebook: item.facebook || '',
                    instagram: item.instagram || '',
                },
                aiAnalysis: {
                    summary: `${item.categoryName || 'Empresa'} con ${item.reviewsCount || 0} reseñas (${item.totalScore || 'N/A'}⭐)`,
                    painPoints: [],
                    generatedIcebreaker: '',
                    fullMessage: ''
                },
                status: item.email ? 'enriched' : 'scraped'
            }));

            onLog(`[STAGE 1] 📊 ${basicLeads.filter(l => l.decisionMaker?.email).length}/${basicLeads.length} con email`);

            // ═══════════════════════════════════════════════════════════════════
            // STAGE 2: Contact Info Scraper (for leads without email)
            // ═══════════════════════════════════════════════════════════════════
            const leadsWithoutEmail = basicLeads.filter(l => !l.decisionMaker?.email && l.website);

            if (leadsWithoutEmail.length > 0 && this.isRunning) {
                onLog(`[STAGE 2] 🔍 Enriqueciendo ${leadsWithoutEmail.length} leads sin email...`);

                const websiteUrls = leadsWithoutEmail.map(l => `https://${l.website}`).slice(0, 10); // Limit batch

                const contactInput = {
                    startUrls: websiteUrls.map(url => ({ url })),
                    maxRequestsPerWebsite: 3,
                    sameDomainOnly: true,
                };

                try {
                    const contactResults = await this.callApifyActor(CONTACT_SCRAPER, contactInput, onLog);

                    // Merge contact results back into leads
                    for (const contact of contactResults) {
                        const domain = contact.domain || '';
                        const matchingLead = basicLeads.find(l =>
                            l.website && domain.includes(l.website.replace('www.', ''))
                        );

                        if (matchingLead && matchingLead.decisionMaker) {
                            if (contact.emails?.length > 0) {
                                matchingLead.decisionMaker.email = contact.emails[0];
                                matchingLead.status = 'enriched';
                            }
                            if (contact.phones?.length > 0 && !matchingLead.decisionMaker.phone) {
                                matchingLead.decisionMaker.phone = contact.phones[0];
                            }
                            if (contact.linkedIn) {
                                matchingLead.decisionMaker.linkedin = contact.linkedIn;
                            }
                            if (contact.facebook) {
                                matchingLead.decisionMaker.facebook = contact.facebook;
                            }
                            if (contact.instagram) {
                                matchingLead.decisionMaker.instagram = contact.instagram;
                            }
                        }
                    }

                    onLog(`[STAGE 2] ✅ Enriquecimiento completado`);
                } catch (e: any) {
                    onLog(`[STAGE 2] ⚠️ Error en enriquecimiento: ${e.message}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════════
            // STAGE 3: Decision Maker Finder (optional - for top prospects)
            // ═══════════════════════════════════════════════════════════════════
            const topLeadsForDM = basicLeads
                .filter(l => l.decisionMaker?.email && l.website)
                .slice(0, 5); // Limit to top 5 to save credits

            if (topLeadsForDM.length > 0 && this.isRunning) {
                onLog(`[STAGE 3] 👤 Buscando decisores para ${topLeadsForDM.length} empresas top...`);

                const dmInput = {
                    urls: topLeadsForDM.map(l => `https://${l.website}`),
                    maxPagesPerDomain: 5,
                };

                try {
                    const dmResults = await this.callApifyActor(DECISION_MAKER_FINDER, dmInput, onLog);

                    for (const dm of dmResults) {
                        const domain = dm.domain || dm.url || '';
                        const matchingLead = basicLeads.find(l =>
                            l.website && domain.includes(l.website.replace('www.', ''))
                        );

                        if (matchingLead && matchingLead.decisionMaker && dm.decisionMakers?.length > 0) {
                            const topDM = dm.decisionMakers[0];
                            matchingLead.decisionMaker.name = topDM.name || '';
                            matchingLead.decisionMaker.role = topDM.title || topDM.position || 'Propietario';
                            if (topDM.email) matchingLead.decisionMaker.email = topDM.email;
                            if (topDM.linkedin) matchingLead.decisionMaker.linkedin = topDM.linkedin;
                            matchingLead.status = 'ready';
                        }
                    }

                    onLog(`[STAGE 3] ✅ Decisores identificados`);
                } catch (e: any) {
                    onLog(`[STAGE 3] ⚠️ Error buscando decisores: ${e.message}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════════
            // FINAL: Return all leads
            // ═══════════════════════════════════════════════════════════════════
            const enrichedCount = basicLeads.filter(l => l.decisionMaker?.email).length;
            const readyCount = basicLeads.filter(l => l.status === 'ready').length;

            onLog(`[FINALIZADO] 🎯 ${basicLeads.length} leads totales:`);
            onLog(`   • ${enrichedCount} con email`);
            onLog(`   • ${readyCount} con decisor identificado`);

            onComplete(basicLeads);

        } catch (error: any) {
            console.error(error);
            onLog(`[ERROR] ❌ Fallo crítico: ${error.message}`);
            onComplete([]);
        } finally {
            this.isRunning = false;
        }
    }
}

export const searchService = new SearchService();
