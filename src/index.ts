import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, validateEnv } from './config/env.js';
import { serviceRoutes } from './routes/messages.routes.js';
import { kafkaConsumerService } from './services/kafka-consumer.service.js';
import { kafkaProducerService } from './services/kafka.service.js';

const APP_NAME = 'IOT-ISADATAPRO-OGX-MIDDLEWARE';
const VERSION = '1.0.0';

/**
 * Inicializa o servidor Fastify
 */
async function bootstrap() {

  validateEnv();

  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });


  /**
   * Registra plugins
   */
  await fastify.register(cors, {
    origin: true,
  });


  /**
   * Registra rotas
   */
  await fastify.register(serviceRoutes, { prefix: '/api' });


  /**
   * Rota raiz
   */
  fastify.get('/', async () => {
    return {
      name: APP_NAME,
      version: VERSION,
      description: 'Middleware de tradução OGx <-> IDP',
      endpoints: {
        status: 'GET /api/status',
        health: 'GET /api/health',
      },
    };
  });


  /**
   * Graceful shutdown
   */
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] Recebido ${signal}. Encerrando...`);
    await kafkaConsumerService.disconnect();
    await kafkaProducerService.disconnect();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  /**
   * Inicia o servidor
   */
  try {

    await fastify.listen({ port: config.PORT, host: config.HOST });

    console.log(`
═══════════════════════════════════════════════════════════
                                                           
        ${APP_NAME} v${VERSION}                              
                                                           
    Servidor: http://${config.HOST}:${config.PORT}          
    Kafka: ${config.KAFKA_ENABLED ? config.KAFKA_BROKER : 'desabilitado'}
    Consumer Topics:
      - ${config.KAFKA_TOPIC_RECEIVED}
      - ${config.KAFKA_TOPIC_TRANSLATE}
    Producer Topic: ${config.KAFKA_TOPIC_SEND}
    Forward API: ${config.FORWARD_API_ENABLED ? config.FORWARD_API_URL : 'desabilitada'}
                                                           
═══════════════════════════════════════════════════════════
`);

    // Conecta Kafka Producer (para publicar no send.message.ogx)
    await kafkaProducerService.connect();

    // Conecta Kafka Consumers (received.message.ogx + translate.message.ogx)
    await kafkaConsumerService.connect();

  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

bootstrap();
