import { Request, Response, NextFunction } from 'express';
import { TicketRepository } from '../repository/TicketRepository';
import { OrderRepository } from '../repository/OrderRepository';
import { TicketStatus, TicketPriority } from '../models/Ticket';
import { UserRole } from '../../users/models/User';
import { logger } from '../../utils/logger';

export class TicketController {
  private ticketRepository: TicketRepository;
  private orderRepository: OrderRepository;

  constructor() {
    this.ticketRepository = new TicketRepository();
    this.orderRepository = new OrderRepository();
  }

  // Create a new ticket
  async createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      const { subject, category, priority, message, orderId } = req.body;

      // Validate required fields
      if (!subject || !category || !message) {
        res.status(400).json({
          success: false,
          message: 'Subject, category, and message are required'
        });
        return;
      }

      // Create ticket with initial message
      const ticketData: any = {
        user: userId,
        subject,
        category,
        priority: priority || TicketPriority.MEDIUM,
        messages: [{
          sender: userId,
          senderRole: UserRole.USER,
          message,
          createdAt: new Date()
        }]
      };

      // If orderId is provided, look up the order by orderNumber to get the actual ObjectId
      if (orderId) {
        try {
          const order = await this.orderRepository.findByOrderNumber(orderId);
          if (order) {
            ticketData.order = order._id;
          }
        } catch (error) {
          // If order lookup fails, continue without order reference
          console.warn('Order lookup failed, continuing without order reference:', error);
        }
      }

      const ticket = await this.ticketRepository.create(ticketData);

      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createTicket', `Failed to create ticket: ${error}`);
      next(error);
    }
  }

  // Get user's tickets
  async getUserTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      const { page = 1, limit = 10, status, category } = req.query;

      const filters: any = { user: userId };
      if (status) filters.status = status;
      if (category) filters.category = category;

      const tickets = await this.ticketRepository.findByUser(
        userId,
        Number(page),
        Number(limit),
        filters
      );

      const total = await this.ticketRepository.countByUser(userId, filters);

      res.json({
        success: true,
        data: tickets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getUserTickets', `Failed to get user tickets: ${error}`);
      next(error);
    }
  }

  // Get ticket by ID
  async getTicketById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      const { ticketId } = req.params;

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      // Check if user owns the ticket (for user routes)
      // Admin routes are protected by requireAdmin middleware
      if (ticket.user.toString() !== userId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getTicketById', `Failed to get ticket by ID: ${error}`);
      next(error);
    }
  }

  // Add message to ticket
  async addMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      const { ticketId } = req.params;
      const { message, attachments } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          message: 'Message is required'
        });
        return;
      }

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      // Check if user owns the ticket (for user routes)
      // Admin routes are protected by requireAdmin middleware
      if (ticket.user.toString() !== userId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      // For user routes, sender is always USER
      // Admin routes are handled separately with requireAdmin middleware
      const senderRole = UserRole.USER;

      const messageData = {
        sender: userId,
        senderRole,
        message,
        attachments: attachments || [],
        createdAt: new Date()
      };

      const updatedTicket = await this.ticketRepository.addMessage(ticketId, messageData);

      // Update ticket status based on customer message
      let newStatus = ticket.status;
      if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
        newStatus = TicketStatus.OPEN;
      }

      await this.ticketRepository.updateStatus(ticketId, newStatus);

      res.json({
        success: true,
        message: 'Message added successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'addMessage', `Failed to add message: ${error}`);
      next(error);
    }
  }

  // Update ticket status (admin only)
  async updateTicketStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      if (!Object.values(TicketStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
        return;
      }

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      const updatedTicket = await this.ticketRepository.updateStatus(ticketId, status);

      res.json({
        success: true,
        message: 'Ticket status updated successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'admin', 'updateTicketStatus', `Failed to update status: ${error}`);
      next(error);
    }
  }

  // Update ticket priority (admin only)
  async updateTicketPriority(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { priority } = req.body;

      if (!Object.values(TicketPriority).includes(priority)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority'
        });
        return;
      }

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      const updatedTicket = await this.ticketRepository.updatePriority(ticketId, priority);

      res.json({
        success: true,
        message: 'Ticket priority updated successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'admin', 'updateTicketPriority', `Failed to update priority: ${error}`);
      next(error);
    }
  }

  // Escalate ticket (admin only)
  async escalateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ticketId } = req.params;

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      const updatedTicket = await this.ticketRepository.escalate(ticketId);

      res.json({
        success: true,
        message: 'Ticket escalated successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'admin', 'escalateTicket', `Failed to escalate ticket: ${error}`);
      next(error);
    }
  }

  // Get all tickets (admin only)
  async getAllTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10, status, category, priority, search } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (priority) filters.priority = priority;
      if (search) filters.search = search;

      const tickets = await this.ticketRepository.findAll(
        Number(page),
        Number(limit),
        filters
      );

      const total = await this.ticketRepository.countAll(filters);

      res.json({
        success: true,
        data: tickets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'admin', 'getAllTickets', `Failed to get all tickets: ${error}`);
      next(error);
    }
  }

  // Close ticket (user)
  async closeTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      const { ticketId } = req.params;

      const ticket = await this.ticketRepository.findByTicketId(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      // Check if user owns the ticket
      if (ticket.user.toString() !== userId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      const updatedTicket = await this.ticketRepository.updateStatus(ticketId, TicketStatus.CLOSED);

      res.json({
        success: true,
        message: 'Ticket closed successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'closeTicket', `Failed to close ticket: ${error}`);
      next(error);
    }
  }

  // Get ticket statistics (admin only)
  async getTicketStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.ticketRepository.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error(req.user?._id?.toString() || 'admin', 'getTicketStats', `Failed to get ticket stats: ${error}`);
      next(error);
    }
  }
}
