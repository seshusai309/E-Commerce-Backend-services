import { Router } from 'express';
import { TicketController } from '../controller/TicketController';
import { authenticateToken, requireAdmin } from '../../middleware/auth';

const router = Router();
const ticketController = new TicketController();

// User ticket routes (require authentication)
router.post('/', authenticateToken, ticketController.createTicket.bind(ticketController));
router.get('/', authenticateToken, ticketController.getUserTickets.bind(ticketController));
router.get('/:ticketId', authenticateToken, ticketController.getTicketById.bind(ticketController));
router.post('/:ticketId/messages', authenticateToken, ticketController.addMessage.bind(ticketController));
router.patch('/:ticketId/close', authenticateToken, ticketController.closeTicket.bind(ticketController));

// Admin only routes
router.get('/admin/all', authenticateToken, requireAdmin, ticketController.getAllTickets.bind(ticketController));
router.patch('/admin/:ticketId/status', authenticateToken, requireAdmin, ticketController.updateTicketStatus.bind(ticketController));
router.patch('/admin/:ticketId/priority', authenticateToken, requireAdmin, ticketController.updateTicketPriority.bind(ticketController));
router.patch('/admin/:ticketId/escalate', authenticateToken, requireAdmin, ticketController.escalateTicket.bind(ticketController));
router.get('/admin/stats', authenticateToken, requireAdmin, ticketController.getTicketStats.bind(ticketController));

export default router;
