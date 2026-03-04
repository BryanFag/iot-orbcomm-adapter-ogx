import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { kafkaConsumerService } from '../services/kafka-consumer.service.js';
import { kafkaProducerService } from '../services/kafka.service.js';
import { messageForwarderService } from '../services/message-forwarder.service.js';


/**
 * Rotas de controle do serviço
 */
export async function serviceRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /status
     * Retorna o status completo do serviço
     */
    fastify.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
        const consumersState = kafkaConsumerService.getState();
        const producerState = kafkaProducerService.getState();
        const forwarderState = messageForwarderService.getState();

        return reply.send({
            success: true,
            service: 'IOT-ISADATAPRO-OGX-MIDDLEWARE',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            kafkaConsumers: consumersState,
            kafkaProducer: producerState,
            forwarder: forwarderState,
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
