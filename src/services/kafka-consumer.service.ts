import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from '../config/env.js';
import { messageForwarderService } from './message-forwarder.service.js';
import { kafkaProducerService } from './kafka.service.js';
import type { OGxMessage, TranslateMessage, SendMessageOGx } from '../types/ogws.types.js';

/**
 * Contador para gerar UserMessageID único
 */
let messageIdCounter = Date.now() % 100000;

/**
 * Serviço Consumer Kafka
 * Consumer 1: Escuta received.message.ogx → converte OGx→IDP → POST na Forward API
 * Consumer 2: Escuta translate.message.ogx → converte IDP→OGx → publica no send.message.ogx
 */
class KafkaConsumerService {
    private kafka: Kafka | null = null;
    private consumerReceived: Consumer | null = null;
    private consumerTranslate: Consumer | null = null;
    private isReceivedConnected = false;
    private isTranslateConnected = false;
    private receivedMessagesProcessed = 0;
    private translateMessagesProcessed = 0;
    private errors = 0;

    /**
     * Conecta e inicia ambos os consumers Kafka
     */
    async connect(): Promise<void> {
        if (!config.KAFKA_ENABLED) {
            console.log('[KAFKA-CONSUMER] Kafka consumers desabilitados via configuracao');
            return;
        }

        this.kafka = new Kafka({
            clientId: 'iot-isadatapro-ogx-middleware',
            brokers: [config.KAFKA_BROKER],
            logLevel: logLevel.WARN,
            retry: {
                initialRetryTime: 1000,
                retries: 5,
            },
        });

        await this.connectReceivedConsumer();
        await this.connectTranslateConsumer();
    }

    /**
     * Consumer 1: Escuta received.message.ogx
     * Recebe mensagem OGx → converte para IDP → POST na Forward API
     */
    private async connectReceivedConsumer(): Promise<void> {
        if (!this.kafka) return;

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[CONSUMER-RECEIVED] CONECTANDO AO KAFKA');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Broker: ${config.KAFKA_BROKER}`);
        console.log(`Group ID: ${config.KAFKA_GROUP_ID}`);
        console.log(`Topic: ${config.KAFKA_TOPIC_RECEIVED}`);

        try {
            this.consumerReceived = this.kafka.consumer({
                groupId: `${config.KAFKA_GROUP_ID}-received`,
            });

            await this.consumerReceived.connect();
            this.isReceivedConnected = true;

            await this.consumerReceived.subscribe({
                topic: config.KAFKA_TOPIC_RECEIVED,
                fromBeginning: false,
            });

            await this.consumerReceived.run({
                eachMessage: async ({ topic, partition, message }) => {
                    await this.handleReceivedMessage(topic, partition, message);
                },
            });

            console.log('[SUCCESS] Consumer received.message.ogx conectado e escutando');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        } catch (error) {
            this.errors++;
            console.error('[ERROR] Erro ao conectar consumer received:', error);
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        }
    }

    /**
     * Consumer 2: Escuta translate.message.ogx
     * Recebe mensagem IDP → converte para OGx → publica no send.message.ogx
     */
    private async connectTranslateConsumer(): Promise<void> {
        if (!this.kafka) return;

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[CONSUMER-TRANSLATE] CONECTANDO AO KAFKA');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Broker: ${config.KAFKA_BROKER}`);
        console.log(`Group ID: ${config.KAFKA_GROUP_ID}`);
        console.log(`Topic: ${config.KAFKA_TOPIC_TRANSLATE}`);

        try {
            this.consumerTranslate = this.kafka.consumer({
                groupId: `${config.KAFKA_GROUP_ID}-translate`,
            });

            await this.consumerTranslate.connect();
            this.isTranslateConnected = true;

            await this.consumerTranslate.subscribe({
                topic: config.KAFKA_TOPIC_TRANSLATE,
                fromBeginning: false,
            });

            await this.consumerTranslate.run({
                eachMessage: async ({ topic, partition, message }) => {
                    await this.handleTranslateMessage(topic, partition, message);
                },
            });

            console.log('[SUCCESS] Consumer translate.message.ogx conectado e escutando');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        } catch (error) {
            this.errors++;
            console.error('[ERROR] Erro ao conectar consumer translate:', error);
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        }
    }

    /**
     * Desconecta ambos os consumers
     */
    async disconnect(): Promise<void> {
        if (this.consumerReceived && this.isReceivedConnected) {
            await this.consumerReceived.disconnect();
            this.isReceivedConnected = false;
            console.log('[CONSUMER-RECEIVED] Consumer desconectado');
        }
        if (this.consumerTranslate && this.isTranslateConnected) {
            await this.consumerTranslate.disconnect();
            this.isTranslateConnected = false;
            console.log('[CONSUMER-TRANSLATE] Consumer desconectado');
        }
    }

    /**
     * Handler do Consumer 1 (received.message.ogx)
     * Recebe mensagem OGx, converte para IDP e faz POST na Forward API
     */
    private async handleReceivedMessage(
        topic: string,
        partition: number,
        message: { key?: Buffer | null; value: Buffer | null; timestamp: string },
    ): Promise<void> {
        if (!message.value) {
            console.log('[CONSUMER-RECEIVED] Mensagem vazia recebida, ignorando');
            return;
        }

        const raw = message.value.toString();

        console.log('');
        console.log('───────────────────────────────────────────────────────');
        console.log(`[CONSUMER-RECEIVED] MENSAGEM RECEBIDA (topic: ${topic}, partition: ${partition})`);
        console.log('───────────────────────────────────────────────────────');
        console.log(`Payload: ${raw}`);

        let ogxMessage: OGxMessage;
        try {
            ogxMessage = JSON.parse(raw) as OGxMessage;
        } catch {
            this.errors++;
            console.error('[CONSUMER-RECEIVED] Erro ao fazer parse da mensagem JSON:', raw);
            return;
        }

        try {
            // Encaminha para o message-forwarder que converte OGx→IDP e faz POST
            await messageForwarderService.forwardOGxMessage(ogxMessage);
            this.receivedMessagesProcessed++;
            console.log(`[CONSUMER-RECEIVED] Mensagem ID=${ogxMessage.ID} processada com sucesso`);
            console.log('───────────────────────────────────────────────────────');
        } catch (error) {
            this.errors++;
            console.error('[CONSUMER-RECEIVED] Erro ao processar mensagem:', error);
        }
    }

    /**
     * Handler do Consumer 2 (translate.message.ogx)
     * Recebe mensagem IDP, converte para OGx e publica no send.message.ogx
     */
    private async handleTranslateMessage(
        topic: string,
        partition: number,
        message: { key?: Buffer | null; value: Buffer | null; timestamp: string },
    ): Promise<void> {
        if (!message.value) {
            console.log('[CONSUMER-TRANSLATE] Mensagem vazia recebida, ignorando');
            return;
        }

        const raw = message.value.toString();

        console.log('');
        console.log('───────────────────────────────────────────────────────');
        console.log(`[CONSUMER-TRANSLATE] MENSAGEM RECEBIDA (topic: ${topic}, partition: ${partition})`);
        console.log('───────────────────────────────────────────────────────');
        console.log(`Payload: ${raw}`);

        let idpMessage: TranslateMessage;
        try {
            idpMessage = JSON.parse(raw) as TranslateMessage;
        } catch {
            this.errors++;
            console.error('[CONSUMER-TRANSLATE] Erro ao fazer parse da mensagem JSON:', raw);
            return;
        }

        if (!idpMessage.DestinationID) {
            this.errors++;
            console.error('[CONSUMER-TRANSLATE] Mensagem sem DestinationID, ignorando');
            return;
        }

        try {
            // Converte IDP → OGx
            const ogxMessage = this.convertIdpToOGx(idpMessage);

            console.log(`[CONSUMER-TRANSLATE] Convertido IDP→OGx para dispositivo ${ogxMessage.DestinationID}`);
            console.log(`   UserMessageID: ${ogxMessage.UserMessageID}`);
            if (ogxMessage.RawPayload) {
                console.log(`   RawPayload (base64): ${ogxMessage.RawPayload}`);
            }
            if (ogxMessage.Payload) {
                console.log(`   Payload: SIN=${ogxMessage.Payload.SIN}, MIN=${ogxMessage.Payload.MIN}`);
            }

            // Publica no tópico send.message.ogx
            await kafkaProducerService.publishSendMessage(ogxMessage);

            this.translateMessagesProcessed++;
            console.log(`[CONSUMER-TRANSLATE] Mensagem publicada no topic ${config.KAFKA_TOPIC_SEND}`);
            console.log('───────────────────────────────────────────────────────');
        } catch (error) {
            this.errors++;
            console.error('[CONSUMER-TRANSLATE] Erro ao processar mensagem:', error);
        }
    }

    /**
     * Converte mensagem IDP para formato OGx
     * - RawPayload: array de bytes → Base64 string
     * - Valida que o RawPayload é enviado como Base64 (formato esperado pela ORBCOMM)
     */
    private convertIdpToOGx(idpMessage: TranslateMessage): SendMessageOGx {
        const msgId = idpMessage.UserMessageID ?? ++messageIdCounter;

        const ogxMessage: SendMessageOGx = {
            DestinationID: idpMessage.DestinationID,
            UserMessageID: msgId,
        };

        if (idpMessage.RawPayload && Array.isArray(idpMessage.RawPayload) && idpMessage.RawPayload.length > 0) {
            // Converte array de bytes para Base64 (formato OGx esperado pela ORBCOMM)
            const base64Payload = Buffer.from(idpMessage.RawPayload).toString('base64');
            ogxMessage.RawPayload = base64Payload;
            console.log(`[CONVERT IDP→OGx] RawPayload: ${idpMessage.RawPayload.length} bytes → base64: ${base64Payload}`);
        } else if (typeof idpMessage.RawPayload === 'string') {
            // RawPayload já veio como string (possivelmente já Base64) — repassa direto
            ogxMessage.RawPayload = idpMessage.RawPayload;
            console.log(`[CONVERT IDP→OGx] RawPayload já é string (base64): ${idpMessage.RawPayload}`);
        } else if (idpMessage.SIN !== undefined && idpMessage.MIN !== undefined) {
            // Payload estruturado (sem RawPayload)
            ogxMessage.Payload = {
                Name: 'command',
                SIN: idpMessage.SIN,
                MIN: idpMessage.MIN,
                IsForward: true,
                Fields: idpMessage.Fields?.map(f => ({
                    Name: f.Name,
                    Value: f.Value,
                })) || [],
            };
            console.log(`[CONVERT IDP→OGx] Payload estruturado: SIN=${idpMessage.SIN}, MIN=${idpMessage.MIN}`);
        } else {
            console.warn('[CONVERT IDP→OGx] Mensagem sem RawPayload e sem SIN/MIN');
        }

        return ogxMessage;
    }

    /**
     * Retorna o estado atual dos consumers
     */
    getState(): {
        received: { connected: boolean; topic: string; messagesProcessed: number };
        translate: { connected: boolean; topic: string; messagesProcessed: number };
        errors: number;
    } {
        return {
            received: {
                connected: this.isReceivedConnected,
                topic: config.KAFKA_TOPIC_RECEIVED,
                messagesProcessed: this.receivedMessagesProcessed,
            },
            translate: {
                connected: this.isTranslateConnected,
                topic: config.KAFKA_TOPIC_TRANSLATE,
                messagesProcessed: this.translateMessagesProcessed,
            },
            errors: this.errors,
        };
    }
}

export const kafkaConsumerService = new KafkaConsumerService();
