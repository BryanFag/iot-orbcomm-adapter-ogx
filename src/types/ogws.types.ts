/**
 * Tipos para a API ORBCOMM OGWS
 * Baseado no documento N214 OGWS User Guide
 */

// ============================================
// FORMATO COMUM DE MENSAGEM
// ============================================

export interface MessageField {
    Name: string;
    Value: string | null;
    Type?: 'enum' | 'boolean' | 'unsignedint' | 'signedint' | 'string' | 'data' | 'array' | 'message';
    Elements?: MessageElement[] | null;
    Message?: CommonMessage | null;
}

export interface MessageElement {
    Index: number;
    Fields: MessageField[];
}

export interface CommonMessage {
    Name: string;
    SIN: number;
    MIN: number;
    IsForward?: boolean | null;
    Fields: MessageField[];
}

// ============================================
// MENSAGENS FROM-MOBILE (RE - Return)
// ============================================

export interface ReturnMessage {
    ID: number;
    MessageUTC: string;
    ReceiveUTC: string;
    SIN: number;
    MobileID: string;
    Payload?: CommonMessage;
    RawPayload?: string;
    RegionName?: string;
    OTAMessageSize: number;
    Transport?: number;
    Network?: number;
}

export interface GetReturnMessagesResponse {
    NextFromUTC: string;
    Messages: ReturnMessage[];
}

// ============================================
// MENSAGENS TO-MOBILE (FW - Forward)
// ============================================

export interface ForwardMessageSubmit {
    DestinationID: string;
    UserMessageID?: number;
    Payload?: CommonMessage;
    RawPayload?: number[];
}

export interface ForwardMessageStatus {
    ForwardMessageID: number;
    UserMessageID: number;
    DestinationID: string;
    State: number;
    StateUTC: string;
    ErrorID: number;
    IsClosed: boolean;
    ReferenceNumber?: number;
}

export interface SubmitMessagesResponse {
    ErrorID: number;
    Submissions: {
        ForwardMessageID: number;
        UserMessageID: number;
        DestinationID: string;
        ErrorID: number;
    }[];
}

// ============================================
// CONFIGURAÇÃO LOCAL
// ============================================

export interface EnvConfig {
    PORT: number;
    HOST: string;
    OGWS_BASE_URL: string;
    OGWS_ACCESS_ID: string;
    OGWS_PASSWORD: string;
    POLLING_INTERVAL_SECONDS: number;
    KAFKA_BROKER: string;
    KAFKA_TOPIC: string;
    KAFKA_ENABLED: boolean;
}

export interface CollectorState {
    isRunning: boolean;
    lastCollectUTC: string | null;
    messagesReceived: number;
    errors: number;
}
