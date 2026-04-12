import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { IPaymentNotifier } from '~/domain/contracts/payment-notifier.interface'

@Injectable()
@WebSocketGateway({
  namespace: '/payment',
  cors: {
    origin: '*',
  },
})
export class PaymentGateway implements OnGatewayConnection, OnGatewayDisconnect, IPaymentNotifier {
  @WebSocketServer()
  server: Server

  private readonly accessTokenSecret: string

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret = this.configService.get<string>('ACCESS_TOKEN_SECRET')!
  }

  async handleConnection(client: Socket) {
    try {
      // Auth middleware
      const token =
        client.handshake.auth?.token || // nếu ở FE khi khởi tạo kết nối có truyền token vào trong option auth
        client.handshake.headers?.authorization?.replace('Bearer ', '') // hoặc lấy accessToken từ header authorization

      if (!token) {
        client.disconnect()
        return
      }

      // Verify JWT token (giống auth-service verifyAccessToken)
      const payload = await this.verifyAccessToken(token)
      if (!payload) {
        client.disconnect()
        return
      }

      // Join room user:{userId}
      // 1 user đăng nhập nhiều thiết bị → nhiều socket cùng 1 room
      const roomName = `user:${payload.userId}`
      await client.join(roomName)
      client.data.userId = payload.userId
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(_client: Socket) {
    // Khi user đăng xuất → socket disconnect → tự động leave room
  }

  // Emit payment:success tới tất cả devices của user
  emitPaymentSuccess(userId: string, data: { orderIds: string[]; message: string }) {
    this.server.to(`user:${userId}`).emit('payment:success', data)
  }

  // Emit payment:failed tới tất cả devices của user
  emitPaymentFailed(userId: string, data: { message: string }) {
    this.server.to(`user:${userId}`).emit('payment:failed', data)
  }

  // Emit payment:timeout tới tất cả devices của user
  emitPaymentTimeout(userId: string, data: { message: string }) {
    this.server.to(`user:${userId}`).emit('payment:timeout', data)
  }

  // Emit payment:qrcode tới tất cả devices của user (khi CREATE_PAYMENT xong)
  emitPaymentQRCode(userId: string, data: { qrUrl: string; amount: number; sagaId: string }) {
    this.server.to(`user:${userId}`).emit('payment:qrcode', data)
  }

  /**
   * Verify access token giống auth-service.
   * Tự kiểm tra expiration + signature.
   * Trả về payload { userId, roleId } nếu hợp lệ, null nếu không.
   */
  private async verifyAccessToken(
    token: string,
  ): Promise<{ userId: string; roleId: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{ userId: string; roleId: string }>(token, {
        secret: this.accessTokenSecret,
      })
      return payload
    } catch {
      return null
    }
  }
}
