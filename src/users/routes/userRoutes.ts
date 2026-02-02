import { Router } from 'express';
import { UserController } from '../controller/UserController';
import { AdminController } from '../controller/AdminController';
import { authenticateToken, requireSuperAdmin, requireAdmin , requireUser} from '../../middleware/auth';

const router = Router();
const userController = new UserController();
const adminController = new AdminController();

// Public routes (user operations)
router.post('/register', userController.register.bind(userController));
router.post('/login', userController.login.bind(userController));
router.post('/logout', authenticateToken, userController.logout.bind(userController));

// user only
router.post('/send-otp' , userController.sendOtp.bind(userController));
router.post('/verify-otp', userController.verifyOtp.bind(userController));
router.post('/complete-registration', userController.completeRegistration.bind(userController));
router.post('/reset-password', userController.resetPassword.bind(userController));


router.post('/update-profile', authenticateToken, requireUser, userController.updateProfile.bind(userController));
router.get('/profile', authenticateToken, userController.getProfile.bind(userController));

// all admin operations
router.get('/', authenticateToken, requireAdmin, adminController.getAllUsers.bind(adminController)); // Gets USER role only
router.get('/:id', authenticateToken, requireAdmin, adminController.getUserById.bind(adminController));
router.put('/:id', authenticateToken, requireAdmin, adminController.updateUser.bind(adminController));
router.delete('/:id', authenticateToken, requireAdmin, adminController.deleteUser.bind(adminController));

//super admin only
router.post('/admin/create', authenticateToken, requireSuperAdmin, adminController.createAdmin.bind(adminController));
router.get('/admin/list', authenticateToken, requireSuperAdmin, adminController.getAdminsList.bind(adminController));
router.get('/admin/:id', authenticateToken, requireSuperAdmin, adminController.getAdminById.bind(adminController));
router.put('/admin/:id', authenticateToken, requireSuperAdmin, adminController.updateAdminUser.bind(adminController));
router.delete('/admin/:id', authenticateToken, requireSuperAdmin, adminController.deleteAdminUser.bind(adminController));
router.patch('/admin/:id/demote', authenticateToken, requireSuperAdmin, adminController.demoteAdminUser.bind(adminController));

export default router;
