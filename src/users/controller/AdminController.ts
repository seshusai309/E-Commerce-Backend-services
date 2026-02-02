import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repository/UserRepository';
import { UserStatus, UserRole } from '../models/User';
import { logger } from '../../utils/logger';
import { emailService } from '../../utils/emailService';
import bcrypt from 'bcryptjs';

export class AdminController {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // Get all users with USER role only (admin only)
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      // Only ADMIN and SUPER_ADMIN can view users
      if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
        res.status(403).json({
          success: false,
          message: 'Only ADMIN or SUPER_ADMIN can view users'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get all users (without pagination for total count)
      const allUsers = await this.userRepository.findByRole(UserRole.USER);
      
      // Apply pagination
      const totalRecords = allUsers.length;
      const data = allUsers.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(currentUser.username, 'getAllUsers', `Retrieved ${data.length} users (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'Users retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAllUsers', error.message);
      next(error);
    }
  }

  // Get user by ID (admin only)
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only ADMIN and SUPER_ADMIN can view users
      if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
        res.status(403).json({
          success: false,
          message: 'Only ADMIN or SUPER_ADMIN can view users'
        });
        return;
      }

      const user = await this.userRepository.findById(id as string);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      logger.success(currentUser.username, 'getUserById', `User ${id} retrieved successfully`);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getUserById', error.message);
      next(error);
    }
  }

  // Update user (admin only)
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only ADMIN and SUPER_ADMIN can update users
      if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
        res.status(403).json({
          success: false,
          message: 'Only ADMIN or SUPER_ADMIN can update users'
        });
        return;
      }

      const user = await this.userRepository.updateById(id as string, req.body);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      logger.success(currentUser.username, 'updateUser', `User ${id} updated successfully`);

      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'updateUser', error.message);
      next(error);
    }
  }

  // Delete user (admin only)
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only ADMIN and SUPER_ADMIN can delete users
      if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
        res.status(403).json({
          success: false,
          message: 'Only ADMIN or SUPER_ADMIN can delete users'
        });
        return;
      }

      const success = await this.userRepository.delete(id as string);
      if (!success) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      logger.success(currentUser.username, 'deleteUser', `User ${id} deleted successfully`);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'deleteUser', error.message);
      next(error);
    }
  }

  // Create admin user (SUPER_ADMIN only)
  async createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      // Only SUPER_ADMIN can create admins
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can create admin users'
        });
        return;
      }

      const { username, email, password } = req.body;

      // Validate required fields
      if (!username || !email || !password) {
        res.status(400).json({
          success: false,
          message: 'Username, email, and password are required'
        });
        return;
      }

      // Check if admin already exists
      const existingUser = await this.userRepository.findByEmailOrUsername(email, username);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email or username already exists'
        });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user
      const adminData = {
        username,
        email,
        password: hashedPassword,
        status: UserStatus.ACTIVE,
        role: UserRole.ADMIN
      };

      const admin = await this.userRepository.create(adminData);

      logger.success(currentUser.username, 'createAdmin', `Admin user ${email} created successfully`);

      res.status(201).json({
        success: true,
        data: {
          _id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          status: admin.status
        },
        message: 'Admin user created successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'createAdmin', error.message);
      next(error);
    }
  }

  // Delete Admin User (SUPER_ADMIN only)
  async deleteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only SUPER_ADMIN can delete admins
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can delete admin users'
        });
        return;
      }

      // Find the admin user
      const adminUser = await this.userRepository.findById(id as string);
      if (!adminUser) {
        res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
        return;
      }

      // Prevent deleting SUPER_ADMIN users
      if (adminUser.role === UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Cannot delete SUPER_ADMIN users'
        });
        return;
      }

      // Ensure the user being deleted is an admin
      if (adminUser.role !== UserRole.ADMIN) {
        res.status(400).json({
          success: false,
          message: 'User is not an admin'
        });
        return;
      }

      // Delete the admin user
      await this.userRepository.delete(id as string);

      logger.success(currentUser.username, 'deleteAdminUser', `Admin user ${adminUser.email} deleted successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user deleted successfully',
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'deleteAdminUser', error.message);
      next(error);
    }
  }

  // Demote Admin to User (SUPER_ADMIN only)
  async demoteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only SUPER_ADMIN can demote admins
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can demote admin users'
        });
        return;
      }

      // Find the admin user
      const adminUser = await this.userRepository.findById(id as string);
      if (!adminUser) {
        res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
        return;
      }

      // Prevent demoting SUPER_ADMIN users
      if (adminUser.role === UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Cannot demote SUPER_ADMIN users'
        });
        return;
      }

      // Ensure the user being demoted is an admin
      if (adminUser.role !== UserRole.ADMIN) {
        res.status(400).json({
          success: false,
          message: 'User is not an admin'
        });
        return;
      }

      // Demote to USER role
      const updatedAdmin = await this.userRepository.updateRole(id as string, UserRole.USER);

      logger.success(currentUser.username, 'demoteAdminUser', `Admin user ${adminUser.email} demoted to regular user`);

      res.status(200).json({
        success: true,
        data: updatedAdmin,
        message: 'Admin user demoted to regular user successfully',
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'demoteAdminUser', error.message);
      next(error);
    }
  }

  // Get Admin User by ID (SUPER_ADMIN only)
  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only SUPER_ADMIN can view admin details
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can view admin user details'
        });
        return;
      }

      // Find the admin user
      const adminUser = await this.userRepository.findById(id as string);
      if (!adminUser) {
        res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
        return;
      }

      // Ensure the user is an admin or super admin
      if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
        res.status(400).json({
          success: false,
          message: 'User is not an admin'
        });
        return;
      }

      logger.success(currentUser.username, 'getAdminById', `Admin user ${adminUser.email} retrieved successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user retrieved successfully',
        data: adminUser
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAdminById', error.message);
      next(error);
    }
  }

  // Update Admin User Details (SUPER_ADMIN only)
  async updateAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { username, email, status } = req.body;
      const currentUser = req.user;

      // Only SUPER_ADMIN can update admin details
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can update admin user details'
        });
        return;
      }

      // Find the admin user
      const adminUser = await this.userRepository.findById(id as string);
      if (!adminUser) {
        res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
        return;
      }

      // Prevent updating SUPER_ADMIN users
      if (adminUser.role === UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Cannot update SUPER_ADMIN user details'
        });
        return;
      }

      // Ensure the user being updated is an admin
      if (adminUser.role !== UserRole.ADMIN) {
        res.status(400).json({
          success: false,
          message: 'User is not an admin'
        });
        return;
      }

      // Prepare update data
      const updateData: any = {};

      // Validate and add username if provided
      if (username) {
        if (username !== adminUser.username) {
          const existingUsername = await this.userRepository.findByUsername(username);
          if (existingUsername && existingUsername._id.toString() !== adminUser._id.toString()) {
            res.status(409).json({
              success: false,
              message: 'Username already taken'
            });
            return;
          }
          updateData.username = username;
        }
      }

      // Validate and add email if provided
      if (email) {
        if (email !== adminUser.email) {
          const existingEmail = await this.userRepository.findByEmail(email);
          if (existingEmail && existingEmail._id.toString() !== adminUser._id.toString()) {
            res.status(409).json({
              success: false,
              message: 'Email already registered'
            });
            return;
          }
          updateData.email = email;
        }
      }

      // Add status if provided and valid
      if (status) {
        const validStatuses = [UserStatus.ACTIVE, UserStatus.INACTIVE];
        if (!validStatuses.includes(status)) {
          res.status(400).json({
            success: false,
            message: 'Invalid status. Valid statuses are: ACTIVE, INACTIVE'
          });
          return;
        }
        updateData.status = status;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
        return;
      }

      // Update admin user
      const updatedAdmin = await this.userRepository.updateById(id as string, updateData);

      logger.success(currentUser.username, 'updateAdminUser', `Admin user ${adminUser.email} updated successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user updated successfully',
        data: updatedAdmin
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'updateAdminUser', error.message);
      next(error);
    }
  }

  // Get all admin users (SUPER_ADMIN only)
  async getAdminsList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      // Only SUPER_ADMIN can view admin list
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only SUPER_ADMIN can view admin users list'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get all admin users (without pagination for total count)
      const allAdminUsers = await this.userRepository.findByRole(UserRole.ADMIN);
      
      // Apply pagination
      const totalRecords = allAdminUsers.length;
      const data = allAdminUsers.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(currentUser.username, 'getAdminsList', `Retrieved ${data.length} admin users (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'Admin users retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAdminsList', error.message);
      next(error);
    }
  }
}
