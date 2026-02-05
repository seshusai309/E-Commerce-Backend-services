import { TicketModel, ITicket, TicketStatus, TicketPriority, TicketCategory } from '../models/Ticket';
import { logger } from '../../utils/logger';

export class TicketService {
  // Generate unique ticket ID
  generateTicketId(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TKT${timestamp}${random}`;
  }

  // Validate ticket data
  validateTicketData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
      errors.push('Subject is required and must be a non-empty string');
    }

    if (!data.category || !Object.values(TicketCategory).includes(data.category)) {
      errors.push('Valid category is required');
    }

    if (data.priority && !Object.values(TicketPriority).includes(data.priority)) {
      errors.push('Invalid priority');
    }

    if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
      errors.push('Message is required and must be a non-empty string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format ticket for response
  formatTicketResponse(ticket: ITicket): any {
    return {
      ticketId: ticket.ticketId,
      user: ticket.user,
      order: ticket.order,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      messages: ticket.messages.map(msg => ({
        sender: msg.sender,
        senderRole: msg.senderRole,
        message: msg.message,
        attachments: msg.attachments,
        createdAt: msg.createdAt
      })),
      lastResponseAt: ticket.lastResponseAt,
      isEscalated: ticket.isEscalated,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    };
  }

  // Determine ticket priority based on category and content
  determineTicketPriority(category: TicketCategory, subject: string, message: string): TicketPriority {
    const content = (subject + ' ' + message).toLowerCase();
    
    // Urgent keywords
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'immediate', 'asap', 'payment failed', 'wrong charge', 'double charge'];
    const highKeywords = ['important', 'issue', 'problem', 'broken', 'not working', 'delay', 'lost', 'missing'];
    
    if (urgentKeywords.some(keyword => content.includes(keyword))) {
      return TicketPriority.URGENT;
    }
    
    if (highKeywords.some(keyword => content.includes(keyword))) {
      return TicketPriority.HIGH;
    }
    
    // Category-based priority
    if (category === TicketCategory.PAYMENT || category === TicketCategory.REFUND) {
      return TicketPriority.HIGH;
    }
    
    if (category === TicketCategory.TECHNICAL) {
      return TicketPriority.MEDIUM;
    }
    
    return TicketPriority.MEDIUM;
  }

  // Check if ticket should be auto-escalated
  shouldAutoEscalate(ticket: ITicket): boolean {
    // Auto-escalate if urgent priority
    if (ticket.priority === TicketPriority.URGENT) {
      return true;
    }
    
    // Auto-escalate if ticket is unresolved for more than 48 hours
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    if (ticket.createdAt < twoDaysAgo && ticket.status !== TicketStatus.CLOSED && ticket.status !== TicketStatus.RESOLVED) {
      return true;
    }
    
    // Auto-escalate if ticket has more than 10 messages
    if (ticket.messages.length > 10) {
      return true;
    }
    
    return false;
  }

  // Get ticket statistics
  async getTicketStats(): Promise<any> {
    try {
      const stats = await Promise.all([
        TicketModel.countDocuments({ status: TicketStatus.OPEN }),
        TicketModel.countDocuments({ status: TicketStatus.IN_PROGRESS }),
        TicketModel.countDocuments({ status: TicketStatus.WAITING_CUSTOMER }),
        TicketModel.countDocuments({ status: TicketStatus.RESOLVED }),
        TicketModel.countDocuments({ status: TicketStatus.CLOSED }),
        TicketModel.countDocuments({ priority: TicketPriority.URGENT }),
        TicketModel.countDocuments({ priority: TicketPriority.HIGH }),
        TicketModel.countDocuments({ priority: TicketPriority.MEDIUM }),
        TicketModel.countDocuments({ priority: TicketPriority.LOW }),
        TicketModel.countDocuments({ isEscalated: true }),
        TicketModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }) // Last 24 hours
      ]);

      return {
        byStatus: {
          open: stats[0],
          inProgress: stats[1],
          waitingCustomer: stats[2],
          resolved: stats[3],
          closed: stats[4]
        },
        byPriority: {
          urgent: stats[5],
          high: stats[6],
          medium: stats[7],
          low: stats[8]
        },
        escalated: stats[9],
        newToday: stats[10],
        total: stats[0] + stats[1] + stats[2] + stats[3] + stats[4]
      };
    } catch (error) {
      logger.error('TicketService', 'getTicketStats', `Error getting stats: ${error}`);
      throw error;
    }
  }

  // Search tickets
  async searchTickets(query: string, filters: any = {}): Promise<ITicket[]> {
    try {
      const searchRegex = new RegExp(query, 'i');
      
      const searchQuery: any = {
        $or: [
          { ticketId: searchRegex },
          { subject: searchRegex },
          { 'messages.message': searchRegex }
        ],
        ...filters
      };

      return await TicketModel.find(searchQuery)
        .populate('user', 'name email')
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('TicketService', 'searchTickets', `Error searching tickets: ${error}`);
      throw error;
    }
  }

  // Get ticket response time analytics
  async getResponseTimeAnalytics(): Promise<any> {
    try {
      const tickets = await TicketModel.find({
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      const responseTimes = tickets.map(ticket => {
        if (ticket.messages.length < 2) return null;
        
        const firstMessage = ticket.messages[0];
        const firstResponse = ticket.messages[1];
        
        return firstResponse.createdAt.getTime() - firstMessage.createdAt.getTime();
      }).filter(time => time !== null);

      if (responseTimes.length === 0) {
        return {
          averageResponseTime: 0,
          medianResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0
        };
      }

      responseTimes.sort((a, b) => a - b);
      
      const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const median = responseTimes[Math.floor(responseTimes.length / 2)];
      
      return {
        averageResponseTime: Math.round(average / 1000 / 60), // Convert to minutes
        medianResponseTime: Math.round(median / 1000 / 60), // Convert to minutes
        minResponseTime: Math.round(Math.min(...responseTimes) / 1000 / 60),
        maxResponseTime: Math.round(Math.max(...responseTimes) / 1000 / 60)
      };
    } catch (error) {
      logger.error('TicketService', 'getResponseTimeAnalytics', `Error getting analytics: ${error}`);
      throw error;
    }
  }
}
