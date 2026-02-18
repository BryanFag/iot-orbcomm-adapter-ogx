import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ogwsMessagesService } from '../services/ogws-messages.service.js';
import { ogwsAuthService } from '../services/ogws-auth.service.js';
import { config } from '../config/env.js';

/**
 * Interface para o body da requisição de envio
 */
interface SendMessageBody {
    destinationId: string;
    userMessageId?: number;
    sin?: number;
    min?: number;
    fields?: { name: string; value: string }[];
    rawPayload?: number[];  // Array de bytes que será convertido para base64
}

/**
 * Contador para gerar UserMessageID único
 */
let messageIdCounter = Date.now() % 100000;

/**
 * Rotas para gerenciamento de mensagens OGWS
 */
export async function messagesRoutes(fastify: FastifyInstance): Promise<void> {

    /**
     * GET /messages
     * Retorna todas as mensagens recebidas
     */
    fastify.get('/messages', async (_request: FastifyRequest, reply: FastifyReply) => {
        const messages = ogwsMessagesService.getMessages();
        return reply.send({
            success: true,
            count: messages.length,
            messages,
        });
    });


    /**
     * GET /messages/mobile/:mobileId
     * Retorna mensagens filtradas por MobileID
     */
    fastify.get(
        '/messages/mobile/:mobileId',
        async (request: FastifyRequest<{ Params: { mobileId: string } }>, reply: FastifyReply) => {
            const { mobileId } = request.params;
            const messages = ogwsMessagesService.getMessagesByMobileId(mobileId);
            return reply.send({
                success: true,
                mobileId,
                count: messages.length,
                messages,
            });
        }
    );


    /**
     * GET /messages/sin/:sin
     * Retorna mensagens filtradas por SIN (Service Identification Number)
     */
    fastify.get(
        '/messages/sin/:sin',
        async (request: FastifyRequest<{ Params: { sin: string } }>, reply: FastifyReply) => {
            const sin = parseInt(request.params.sin, 10);
            const messages = ogwsMessagesService.getMessagesBySIN(sin);
            return reply.send({
                success: true,
                sin,
                count: messages.length,
                messages,
            });
        }
    );


    /**
     * POST /messages/collect
     * Força uma busca imediata de mensagens
     */
    fastify.post('/messages/collect', async (_request: FastifyRequest, reply: FastifyReply) => {
        const newMessages = await ogwsMessagesService.collectMessages();
        return reply.send({
            success: true,
            newMessagesCount: newMessages.length,
            newMessages,
        });
    });


    /**
     * POST /messages/send
     * Envia uma mensagem para um dispositivo (To-Mobile / Forward)
     */
    fastify.post(
        '/messages/send',
        async (request: FastifyRequest<{ Body: SendMessageBody }>, reply: FastifyReply) => {
            const { destinationId, userMessageId, sin, min, fields, rawPayload } = request.body;

            if (!destinationId) {
                return reply.status(400).send({
                    success: false,
                    error: 'destinationId é obrigatório',
                });
            }

            try {
                const token = await ogwsAuthService.getToken();
                const url = `${config.OGWS_BASE_URL}/submit/messages`;

                // Gera UserMessageID se não fornecido
                const msgId = userMessageId ?? ++messageIdCounter;

                console.log('');
                console.log('───────────────────────────────────────────────────────');
                console.log('[SEND] ENVIANDO MENSAGEM PARA DISPOSITIVO');
                console.log('───────────────────────────────────────────────────────');
                console.log(`URL: ${url}`);
                console.log(`DestinationID: ${destinationId}`);
                console.log(`UserMessageID: ${msgId}`);
                console.log(`SIN: ${sin}, MIN: ${min}`);

                /**
                 * Monta o payload da mensagem
                 * UserMessageID é obrigatório conforme documentação N214
                 */
                const messagePayload: Record<string, unknown> = {
                    DestinationID: destinationId,
                    UserMessageID: msgId,
                };

                if (rawPayload && rawPayload.length > 0) {
                    // Converte array de bytes para base64 (formato esperado pela API)
                    const base64Payload = Buffer.from(rawPayload).toString('base64');
                    messagePayload.RawPayload = base64Payload;
                    console.log(`RawPayload (bytes): [${rawPayload.join(', ')}]`);
                    console.log(`RawPayload (base64): ${base64Payload}`);
                } else if (sin !== undefined && min !== undefined) {
                    // Payload estruturado com IsForward obrigatório para To-Mobile
                    messagePayload.Payload = {
                        Name: 'command',
                        SIN: sin,
                        MIN: min,
                        IsForward: 'True',
                        Fields: fields?.map(f => ({
                            Name: f.name,
                            Value: f.value,
                        })) || [],
                    };
                    console.log(`Payload: SIN=${sin}, MIN=${min}, IsForward=True`);
                } else {
                    return reply.status(400).send({
                        success: false,
                        error: 'Deve fornecer rawPayload OU sin/min',
                    });
                }

                const requestBody = [messagePayload];
                console.log(`JSON enviado: ${JSON.stringify(requestBody, null, 2)}`);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                const data = await response.json();

                if (!response.ok) {
                    console.log(`[ERROR] Erro ao enviar: ${response.status}`);
                    return reply.status(response.status).send({
                        success: false,
                        error: `Erro ao enviar mensagem: ${response.status}`,
                        details: data,
                    });
                }

                console.log(`[SUCCESS] Mensagem enviada com sucesso`);
                console.log(`Response: ${JSON.stringify(data)}`);
                console.log('───────────────────────────────────────────────────────');

                return reply.send({
                    success: true,
                    message: 'Mensagem enviada com sucesso',
                    userMessageId: msgId,
                    response: data,
                });

            } catch (error) {
                console.error('[ERROR] Erro ao enviar mensagem:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'Erro interno ao enviar mensagem',
                });
            }
        }
    );


    /**
     * DELETE /messages
     * Limpa todas as mensagens armazenadas
     */
    fastify.delete('/messages', async (_request: FastifyRequest, reply: FastifyReply) => {
        ogwsMessagesService.clearMessages();
        return reply.send({
            success: true,
            message: 'Todas as mensagens foram removidas',
        });
    });
}


/**
 * Rotas de controle do serviço
 */
export async function serviceRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /status
     * Retorna o status do serviço
     */
    fastify.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
        const collectorState = ogwsMessagesService.getCollectorState();
        const authStatus = ogwsAuthService.getAuthStatus();

        return reply.send({
            success: true,
            service: 'IOT-ORBCOMM-MIDDLEWARE',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            collector: collectorState,
            authentication: authStatus,
        });
    });


    /**
     * POST /collector/start
     * Inicia o collector de mensagens
     */
    fastify.post('/collector/start', async (_request: FastifyRequest, reply: FastifyReply) => {
        ogwsMessagesService.startCollector();
        return reply.send({
            success: true,
            message: 'Collector iniciado',
            state: ogwsMessagesService.getCollectorState(),
        });
    });


    /**
     * POST /collector/stop
     * Para o collector de mensagens
     */
    fastify.post('/collector/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
        ogwsMessagesService.stopCollector();
        return reply.send({
            success: true,
            message: 'Collector parado',
            state: ogwsMessagesService.getCollectorState(),
        });
    });


    /**
     * GET /health
     * Health check endpoint
     */
    fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({
            status: 'healthy',
            timestamp: new Date().toISOString(),
        });
    });
}
