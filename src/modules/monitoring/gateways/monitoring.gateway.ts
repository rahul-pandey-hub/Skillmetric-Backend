import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ExamMonitoringService } from '../services/exam-monitoring.service';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for Real-Time Exam Monitoring
 * Allows admins/instructors to receive live updates about exam progress
 */
@WebSocketGateway({
  namespace: '/monitoring',
  cors: {
    origin: '*', // Configure based on your frontend URL
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly monitoringService: ExamMonitoringService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up any monitoring intervals for this client
    const intervalKey = `client-${client.id}`;
    if (this.monitoringIntervals.has(intervalKey)) {
      clearInterval(this.monitoringIntervals.get(intervalKey));
      this.monitoringIntervals.delete(intervalKey);
    }
  }

  /**
   * Subscribe to live exam monitoring
   * Client sends: { examId: 'xxx', refreshInterval: 5000 }
   */
  @SubscribeMessage('monitor:exam:subscribe')
  async handleExamMonitoring(client: Socket, payload: { examId: string; refreshInterval?: number }) {
    const { examId, refreshInterval = 5000 } = payload;
    const room = `exam:${examId}`;

    this.logger.log(`Client ${client.id} subscribing to exam ${examId}`);

    // Join room for this exam
    client.join(room);

    // Send initial data
    try {
      const stats = await this.monitoringService.getLiveExamStats(examId);
      client.emit('monitor:exam:update', stats);
    } catch (error) {
      client.emit('monitor:exam:error', { message: error.message });
      return;
    }

    // Set up periodic updates
    const intervalKey = `${client.id}-${examId}`;

    // Clear any existing interval
    if (this.monitoringIntervals.has(intervalKey)) {
      clearInterval(this.monitoringIntervals.get(intervalKey));
    }

    // Create new interval
    const interval = setInterval(async () => {
      try {
        const stats = await this.monitoringService.getLiveExamStats(examId);
        this.server.to(room).emit('monitor:exam:update', stats);
      } catch (error) {
        this.logger.error(`Error fetching exam stats: ${error.message}`);
        this.server.to(room).emit('monitor:exam:error', { message: error.message });
      }
    }, refreshInterval);

    this.monitoringIntervals.set(intervalKey, interval);

    // Acknowledge subscription
    client.emit('monitor:exam:subscribed', { examId, refreshInterval });
  }

  /**
   * Unsubscribe from exam monitoring
   */
  @SubscribeMessage('monitor:exam:unsubscribe')
  handleUnsubscribe(client: Socket, payload: { examId: string }) {
    const { examId } = payload;
    const room = `exam:${examId}`;
    const intervalKey = `${client.id}-${examId}`;

    this.logger.log(`Client ${client.id} unsubscribing from exam ${examId}`);

    // Leave room
    client.leave(room);

    // Clear interval
    if (this.monitoringIntervals.has(intervalKey)) {
      clearInterval(this.monitoringIntervals.get(intervalKey));
      this.monitoringIntervals.delete(intervalKey);
    }

    client.emit('monitor:exam:unsubscribed', { examId });
  }

  /**
   * Subscribe to system-wide monitoring
   */
  @SubscribeMessage('monitor:system:subscribe')
  async handleSystemMonitoring(client: Socket, payload: { refreshInterval?: number }) {
    const { refreshInterval = 10000 } = payload;
    const room = 'system:monitoring';

    this.logger.log(`Client ${client.id} subscribing to system monitoring`);

    // Join room
    client.join(room);

    // Send initial data
    try {
      const stats = await this.monitoringService.getSystemStats();
      client.emit('monitor:system:update', stats);
    } catch (error) {
      client.emit('monitor:system:error', { message: error.message });
      return;
    }

    // Set up periodic updates
    const intervalKey = `${client.id}-system`;

    if (this.monitoringIntervals.has(intervalKey)) {
      clearInterval(this.monitoringIntervals.get(intervalKey));
    }

    const interval = setInterval(async () => {
      try {
        const stats = await this.monitoringService.getSystemStats();
        this.server.to(room).emit('monitor:system:update', stats);
      } catch (error) {
        this.logger.error(`Error fetching system stats: ${error.message}`);
      }
    }, refreshInterval);

    this.monitoringIntervals.set(intervalKey, interval);

    client.emit('monitor:system:subscribed', { refreshInterval });
  }

  /**
   * Unsubscribe from system monitoring
   */
  @SubscribeMessage('monitor:system:unsubscribe')
  handleSystemUnsubscribe(client: Socket) {
    const room = 'system:monitoring';
    const intervalKey = `${client.id}-system`;

    this.logger.log(`Client ${client.id} unsubscribing from system monitoring`);

    client.leave(room);

    if (this.monitoringIntervals.has(intervalKey)) {
      clearInterval(this.monitoringIntervals.get(intervalKey));
      this.monitoringIntervals.delete(intervalKey);
    }

    client.emit('monitor:system:unsubscribed');
  }

  /**
   * Broadcast violation alert to all monitoring clients
   * Called externally when a violation is detected
   */
  broadcastViolation(examId: string, violation: any) {
    const room = `exam:${examId}`;
    this.server.to(room).emit('monitor:violation:alert', violation);
    this.logger.log(`Broadcasting violation alert for exam ${examId}`);
  }

  /**
   * Broadcast exam event (started, submitted, etc.)
   */
  broadcastExamEvent(examId: string, event: any) {
    const room = `exam:${examId}`;
    this.server.to(room).emit('monitor:exam:event', event);
  }
}
