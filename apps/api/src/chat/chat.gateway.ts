import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { JwtAccessPayload } from '../auth/types/jwt-payload.type';

interface ChatSocketData {
  userId: string;
  companyId: string;
  roleId: string;
}

/**
 * Intersecție, nu generic complet (`Socket<Listen, Emit, ...>`) — ne
 * interesează STRICT să restrângem tipul lui `.data` (identitatea pusă la
 * `handleConnection`); tipurile implicite de eveniment (`DefaultEventsMap`)
 * rămân neschimbate, ca `client.emit(...)`/`server.to(...).emit(...)` să
 * accepte în continuare orice nume+payload de eveniment, ca în restul
 * gateway-ului.
 */
type ChatSocket = Socket & { data: ChatSocketData };

/** Forma exactă persistată de `ChatService.createMessage` (include autorul). */
type CreatedChatMessage = Awaited<ReturnType<ChatService['createMessage']>>;

/**
 * Livrare în timp real a mesajelor de chat — înlocuiește poll-ul de 4s
 * (`useChatMessages`, `refetchInterval`) cu push instant. Trimiterea propriu-
 * zisă a mesajului rămâne pe `POST /chat/channels/:id/messages` (validare +
 * permisiuni deja acoperite de teste) — gateway-ul ăsta acoperă STRICT
 * autentificarea/autorizarea conexiunii live și distribuirea evenimentului,
 * nu persistența.
 *
 * Autentificare: NU refolosim `JwtAuthGuard`/`TenantContextMiddleware`
 * (ambele gândite pentru ciclul de viață HTTP al Express, nu pentru
 * handshake-ul Socket.IO) — verificăm tokenul manual la conectare și ținem
 * identitatea pe `client.data`, apoi restabilim `TenantContext` explicit la
 * fiecare eveniment (spre deosebire de HTTP, un singur `TenantContext.run`
 * la conectare NU ar acoperi evenimentele viitoare — fiecare e livrat de
 * Socket.IO printr-un callback separat, în afara acelui `run`).
 *
 * Notă acceptată: conexiunea rămâne autentificată cu identitatea de la
 * handshake până se închide (reload de pagină/deconectare), chiar dacă
 * access tokenul (valabil 15 min) expiră între timp — aceeași fereastră de
 * timp cu care orice request HTTP purtând acel token ar rămâne valid, doar
 * aplicată unei conexiuni mai lungi în loc de poll-uri repetate.
 *
 * `cors` citit direct din `process.env` (nu prin `ConfigService`):
 * `@WebSocketGateway(...)` e evaluat la definirea clasei, înainte să existe
 * containerul de DI — spre deosebire de `app.enableCors()` din `main.ts`,
 * care rulează după bootstrap.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  handleConnection(client: ChatSocket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token);
      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId;
      client.data.roleId = payload.roleId;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: ChatSocket) {
    // Socket.IO părăsește automat toate camerele la deconectare — nimic de
    // curățat manual.
  }

  @SubscribeMessage('join_channel')
  async handleJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { channelId: string },
  ) {
    try {
      await TenantContext.run(
        {
          companyId: client.data.companyId,
          userId: client.data.userId,
          roleId: client.data.roleId,
          isPlatformBypass: false,
        },
        () => this.chatService.assertAccess(body.channelId, client.data.userId),
      );
      await client.join(body.channelId);
    } catch (error) {
      this.logger.warn(
        `Refuz join_channel pentru ${client.data.userId} pe ${body.channelId}: ${error}`,
      );
      client.emit('join_error', {
        channelId: body.channelId,
        message: 'Nu ai acces la acest canal.',
      });
    }
  }

  @SubscribeMessage('leave_channel')
  handleLeave(@ConnectedSocket() client: ChatSocket, @MessageBody() body: { channelId: string }) {
    client.leave(body.channelId);
  }

  /**
   * `ChatService.createMessage` emite `chat.message.created` după ce mesajul
   * e deja salvat, indiferent cine l-a declanșat (azi doar REST, dar la fel
   * ar funcționa dintr-un viitor apel non-HTTP) — ascultătorul de-aici doar
   * îl distribuie camerei Socket.IO cu numele = ID-ul canalului (vezi
   * `handleJoin`).
   */
  @OnEvent('chat.message.created')
  handleMessageCreated(payload: { channelId: string; message: CreatedChatMessage }) {
    this.server.to(payload.channelId).emit('new_message', payload.message);
  }
}
