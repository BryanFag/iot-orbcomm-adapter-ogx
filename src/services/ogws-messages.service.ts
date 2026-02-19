import { config } from '../config/env.js';
import { ogwsAuthService } from './ogws-auth.service.js';
import { kafkaService } from './kafka.service.js';
import type {
    GetReturnMessagesResponse,
    ReturnMessage,
    CollectorState,
} from '../types/ogws.types.js';

/**
 * Serviço de mensagens OGWS
 * Gerencia busca e armazenamento de mensagens From-Mobile (RE)
 */
class OGWSMessagesService {
    private messages: ReturnMessage[] = [];
    private lastCollectUTC: string | null = null;
    private collectorInterval: ReturnType<typeof setInterval> | null = null;
    private isCollecting = false;
    private errorCount = 0;

    /**
     * Inicia o collector de mensagens
     */
    startCollector(): void {
        if (this.collectorInterval) {
            console.log('[WARN] Collector ja esta em execucao');
            return;
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[COLLECTOR] INICIANDO COLLECTOR DE MENSAGENS');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Intervalo: ${config.POLLING_INTERVAL_SECONDS} segundos`);
        console.log(`Endpoint: ${config.OGWS_BASE_URL}/get/re_messages`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

        // Executa imediatamente na primeira vez
        this.collectMessages();

        // Configura intervalo
        this.collectorInterval = setInterval(() => {
            this.collectMessages();
        }, config.POLLING_INTERVAL_SECONDS * 1000);
    }


    /**
     * Para o collector de mensagens
     */
    stopCollector(): void {
        if (this.collectorInterval) {
            clearInterval(this.collectorInterval);
            this.collectorInterval = null;
            console.log('[INFO] Collector de mensagens parado');
        }
    }


    /**
     * Executa uma busca de mensagens
     */
    async collectMessages(): Promise<ReturnMessage[]> {
        if (this.isCollecting) {
            console.log('[WARN] Collector ja em andamento, aguardando...');
            return [];
        }

        this.isCollecting = true;

        try {
            const token = await ogwsAuthService.getToken();
            const newMessages = await this.fetchMessages(token);

            if (newMessages.length > 0) {
                console.log('');
                console.log('═══════════════════════════════════════════════════════');
                console.log(`[MESSAGES] ${newMessages.length} NOVA(S) MENSAGEM(NS) RECEBIDA(S)`);
                console.log('═══════════════════════════════════════════════════════');

                newMessages.forEach((msg, index) => {
                    console.log(`───────────────────────────────────────────────────────`);
                    console.log(`Mensagem #${index + 1}`);
                    console.log(`   ID: ${msg.ID}`);
                    console.log(`   MobileID: ${msg.MobileID}`);
                    console.log(`   SIN: ${msg.SIN}`);
                    console.log(`   Data: ${msg.MessageUTC}`);
                    if (msg.Payload) {
                        console.log(`   Payload: ${msg.Payload.Name} (SIN:${msg.Payload.SIN}, MIN:${msg.Payload.MIN})`);
                        if (msg.Payload.Fields && msg.Payload.Fields.length > 0) {
                            console.log(`   Campos:`);
                            msg.Payload.Fields.forEach(field => {
                                console.log(`     - ${field.Name}: ${field.Value}`);
                            });
                        }
                    }
                    if (msg.RawPayload) {
                        console.log(`   RawPayload: ${msg.RawPayload}`);
                    }
                });

                console.log('═══════════════════════════════════════════════════════');
                console.log('');

                // Publica mensagens no Kafka
                await kafkaService.publishMessages(newMessages);

                this.messages.push(...newMessages);
            } else {
                console.log('[INFO] Nenhuma nova mensagem');
            }

            return newMessages;
        } catch (error) {
            this.errorCount++;
            console.error('[ERROR] Erro no collector de mensagens:', error);
            return [];
        } finally {
            this.isCollecting = false;
        }
    }


    /**
     * Busca mensagens da API OGWS
     */
    private async fetchMessages(token: string): Promise<ReturnMessage[]> {
        /**
         * Define a data de início para buscar mensagens
         * Se não tiver lastCollectUTC, busca dos últimos 5 minutos
         */
        const fromUTC = this.lastCollectUTC || this.getDefaultFromUTC();

        const url = new URL(`${config.OGWS_BASE_URL}/get/re_messages`);
        url.searchParams.append('FromUTC', fromUTC);
        url.searchParams.append('IncludeTypes', 'true');

        console.log('');
        console.log('───────────────────────────────────────────────────────');
        console.log('[FETCH] BUSCANDO MENSAGENS');
        console.log('───────────────────────────────────────────────────────');
        console.log(`URL: ${url.toString()}`);
        console.log(`Token: ${token.substring(0, 30)}...`);
        console.log(`Desde: ${fromUTC}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        /**
         * Token expirado, força reautenticação
         */
        if (!response.ok) {
            if (response.status === 401) {
                await ogwsAuthService.invalidateToken();
            }
            throw new Error(`Erro ao buscar mensagens: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as GetReturnMessagesResponse;

        console.log(`[SUCCESS] Resposta recebida`);
        console.log(`Mensagens: ${data.Messages?.length || 0}`);
        console.log(`Proximo UTC: ${data.NextFromUTC}`);
        console.log('───────────────────────────────────────────────────────');

        /**
         * Atualiza o último UTC para próxima busca
         */
        if (data.NextFromUTC) {
            this.lastCollectUTC = data.NextFromUTC;
        }

        return data.Messages || [];
    }


    /**
     * Retorna UTC padrão (últimos 5 minutos)
     */
    private getDefaultFromUTC(): string {
        const date = new Date(Date.now() - 5 * 60 * 1000);
        return this.formatUTC(date);
    }


    /**
     * Formata data para o padrão OGWS: 'yyyy-MM-dd HH:mm:ss'
     */
    private formatUTC(date: Date): string {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }


    /**
     * Retorna todas as mensagens armazenadas
     */
    getMessages(): ReturnMessage[] {
        return this.messages;
    }


    /**
     * Retorna mensagens filtradas por MobileID
     */
    getMessagesByMobileId(mobileId: string): ReturnMessage[] {
        return this.messages.filter((msg) => msg.MobileID === mobileId);
    }


    /**
     * Retorna mensagens filtradas por SIN (Service Identification Number)
     */
    getMessagesBySIN(sin: number): ReturnMessage[] {
        return this.messages.filter((msg) => msg.SIN === sin);
    }


    /**
     * Limpa mensagens antigas
     */
    clearMessages(): void {
        this.messages = [];
        console.log('[INFO] Mensagens limpas');
    }


    /**
     * Retorna o estado atual do collector
     */
    getCollectorState(): CollectorState {
        return {
            isRunning: this.collectorInterval !== null,
            lastCollectUTC: this.lastCollectUTC,
            messagesReceived: this.messages.length,
            errors: this.errorCount,
        };
    }
}

export const ogwsMessagesService = new OGWSMessagesService();
