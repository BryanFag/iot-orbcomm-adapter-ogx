import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, validateEnv } from './config/env.js';
import { messagesRoutes, serviceRoutes } from './routes/messages.routes.js';
import { ogwsMessagesService } from './services/ogws-messages.service.js';

const APP_NAME = 'IOT-ORBCOMM-MIDDLEWARE';
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
  await fastify.register(messagesRoutes, { prefix: '/api' });
  await fastify.register(serviceRoutes, { prefix: '/api' });


  /**
   * Rota raiz
   */
  fastify.get('/', async () => {
    return {
      name: APP_NAME,
      version: VERSION,
      description: 'Middleware para integração IoT com ORBCOMM OGWS',
      documentation: 'https://partner-support.orbcomm.com',
      endpoints: {
        status: 'GET /api/status',
        health: 'GET /api/health',
        messages: 'GET /api/messages',
        messagesByMobile: 'GET /api/messages/mobile/:mobileId',
        messagesBySIN: 'GET /api/messages/sin/:sin',
        collectNow: 'POST /api/messages/collect',
        sendMessage: 'POST /api/messages/send',
        clearMessages: 'DELETE /api/messages',
        startCollector: 'POST /api/collector/start',
        stopCollector: 'POST /api/collector/stop',
      },
    };
  });


  /**
   * Graceful shutdown
   */
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] Recebido ${signal}. Encerrando...`);
    ogwsMessagesService.stopCollector();
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
    OGWS API: ${config.OGWS_BASE_URL}                       
    Access ID: ${config.OGWS_ACCESS_ID}                     
                                                           
═══════════════════════════════════════════════════════════
`);

    ogwsMessagesService.startCollector(); //Inicia o collector de mensagens

  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

bootstrap();
