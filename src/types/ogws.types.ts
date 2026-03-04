/**
 * Tipos para o serviço de tradução OGx <-> IDP
 */

// ============================================
// FORMATO OGx (mensagens vindas da ORBCOMM)
// ============================================

export interface OGxMessage {
    ID: number;
    MessageUTC: string;
    ReceiveUTC: string;
    SIN: number;
    MobileID: string;
    Payload?: {
        Name: string;
        SIN: number;
        MIN: number;
        IsForward?: boolean | null;
        Fields: { Name: string; Value: string | null }[];
    } | null;
    RawPayload?: string | null;
    RegionName?: string | null;
    OTAMessageSize: number;
    Transport?: number;
    Network?: number;
    CustomerID?: number;
    MobileOwnerID?: number;
}

// ============================================
// FORMATO IDP (mensagens para Forward API)
// ============================================

export interface IDPMessage {
    ID: number;
    SIN: number;
    MobileID: string;
    Transport?: number;
    CustomerID: number;
    MessageUTC: string;
    RawPayload: number[];
    ReceiveUTC: string;
    RegionName?: string | null;
    MobileOwnerID: number;
    OTAMessageSize: number;
}

// ============================================
// FORMATO TO-MOBILE (mensagem do translate.message.ogx)
// ============================================

export interface TranslateMessage {
    DestinationID: string;
    UserMessageID?: number;
    RawPayload?: number[] | string; // byte array (IDP) ou Base64 string (já convertido)
    SIN?: number;
    MIN?: number;
    Fields?: { Name: string; Value: string }[];
}

// ============================================
// FORMATO OGx TO-MOBILE (mensagem para send.message.ogx)
// ============================================

export interface SendMessageOGx {
    DestinationID: string;
    UserMessageID: number;
    RawPayload?: string; // Base64 string (formato OGx)
    Payload?: {
        Name: string;
        SIN: number;
        MIN: number;
        IsForward?: boolean;
        Fields: { Name: string; Value: string }[];
    };
}

// ============================================
// CONFIGURAÇÃO LOCAL
// ============================================

export interface EnvConfig {
    PORT: number;
    HOST: string;
    KAFKA_BROKER: string;
    KAFKA_TOPIC_RECEIVED: string;
    KAFKA_TOPIC_TRANSLATE: string;
    KAFKA_TOPIC_SEND: string;
    KAFKA_GROUP_ID: string;
    KAFKA_ENABLED: boolean;
    FORWARD_API_URL: string;
    FORWARD_ACCOUNT_ID: number;
    FORWARD_API_ENABLED: boolean;
}
