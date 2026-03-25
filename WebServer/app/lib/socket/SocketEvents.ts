import { Message } from "@/@types/network";
import { User } from "@/app/generated/prisma/browser";

export type SocketUser = Pick<User, "id" | "name" | "role" | "email">;

export enum SocketEventType {
  SEND_MESSAGE = "sendMessage",
  RECIEVE_MESSAGE = "receiveMessage",
  INITIATECALL = "initiateCall",
  ANSWERCALL = "answerCall",
  LEAVECALL = "leaveCall",
  CALLENDED = "callEnded",
  ERROR = "error",
  JOINCHAT = "joinChat",
  LEAVECHAT = "leaveChat",
  TYPING = "typing",
  SDP = "sdp",
  GET_ROUTER_CAPABILITIES = "getRouterRtpCapabilities",
  CREATE_TRANSPORT = "createWebRtcTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
}

export enum SocketErrorCallType {
  NO_ANSWER = "noAnswer",
  CONFLICT = "conflict",
}

export enum SocketErrorRequestType {
  INVALID_DATA = "invalidData",
  TIMEOUT = "timeout",
  NOT_FOUND = "notFound",
  UNAUTHORIZED = "unauthorized",
  FORBIDDEN = "forbidden",
  RATE_LIMIT_EXCEEDED = "rateLimitExceeded",
  INTERNAL_SERVER_ERROR = "internalServerError",
  FILE_UPLOAD_FAILED = "fileUploadFailed",
}

export type SocketErrorType = SocketErrorCallType | SocketErrorRequestType;

export type SocketChatMessage = {
  content: string;
  chatId: number;
  file?: SocketFilePayload;
};

export type SocketFilePayload = {
  name: string;
  type: string;
  size: number;
  data: string;
};

export type SocketError = {
  message: string;
  errorType: SocketErrorType;
};

export type Recipient = Pick<User, "id" | "name" | "image">;

// export interface SocketInitiateCall {
//   callId: string;
//   callerId: string;
//   callerName?: string;
//   callerImage?: string;
//   recipients?: Recipient[];
//   chatId: string;
//   chatName?: string;
//   status: CallStatus;
// }

// export interface SocketAnswerCall {
//   userId: string;
//   userName: string;
//   callId: string;
//   chatId: string;
//   answer: CallStatus;
// }

export type SocketLeaveCall = {
  userId?: string;
  userName?: string;
  callId: string;
  chatId: string;
};

export type SocketJoinChat = {
  userName?: string;
  chatId: number;
};

export type SocketLeaveChat = {
  chatId: number;
};

export type SocketCallEnded = {
  callId: string;
  chatId: number;
};

export type SocketSdp = {
  from: string;
  to: string;
  callId: string;
  chatId: number;
  sdpData: string;
};

export type SocketTyping = {
  chatId: number;
  userId: string;
  userName?: string;
};

export type SocketEventPayloadMap = {
  [SocketEventType.SEND_MESSAGE]: SocketChatMessage;
  [SocketEventType.RECIEVE_MESSAGE]: Message;
  [SocketEventType.INITIATECALL]: unknown;
  [SocketEventType.ANSWERCALL]: unknown;
  [SocketEventType.LEAVECALL]: SocketLeaveCall;
  [SocketEventType.CALLENDED]: SocketCallEnded;
  [SocketEventType.ERROR]: SocketError;
  [SocketEventType.JOINCHAT]: SocketJoinChat;
  [SocketEventType.LEAVECHAT]: SocketLeaveChat;
  [SocketEventType.TYPING]: SocketTyping;
  [SocketEventType.SDP]: SocketSdp;
  [SocketEventType.GET_ROUTER_CAPABILITIES]: unknown;
  [SocketEventType.CREATE_TRANSPORT]: unknown;
  [SocketEventType.CONNECT_TRANSPORT]: unknown;
  [SocketEventType.PRODUCE]: unknown;
  [SocketEventType.CONSUME]: unknown;
};

export type SocketEventPayload<T extends SocketEventType> =
  SocketEventPayloadMap[T];

export type SocketEvent<T extends SocketEventType = SocketEventType> = {
  type: T;
  payload: SocketEventPayload<T>;
};

export type AnySocketEvent = {
  [K in SocketEventType]: SocketEvent<K>;
}[SocketEventType];

// export interface SocketGetRouterCapabilities {
//   routerRtpCapabilities: types.RtpCapabilities;
// }

// export interface SocketCreateTransport {
//   transportOptions: TransportOptions;
// }

// export interface SocketConnectTransport {
//   transportId: string;
//   dtlsParameters: types.DtlsParameters;
// }

// export interface SocketProduce {
//   transportId: string;
//   kind: "audio" | "video";
//   rtpParameters: types.RtpParameters;
// }

// export interface SocketConsume {
//   producerId: string;
//   rtpCapabilities: types.RtpCapabilities;
//   paused?: boolean;
// }
