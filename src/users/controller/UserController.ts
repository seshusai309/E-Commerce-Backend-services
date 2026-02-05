import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repository/UserRepository';
import { UserStatus, UserRole } from '../models/User';
import { logger } from '../../utils/logger';
import { emailService } from '../../utils/emailService';
import bcrypt from 'bcryptjs';

export class UserController {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // Register new user (USER role only)
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, confirmPassword, firstName, lastName, phoneNumber, countryCode } = req.body;

      // Validate required fields
      if (!username || !email || !password || !confirmPassword || !firstName || !lastName || !phoneNumber || !countryCode) {
        res.status(400).json({
          success: false,
          message: 'Username, email, password, confirm password, firstName, lastName, phoneNumber, and countryCode are required'
        });
        return;
      }

      // Validate password
      if (password !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
        return;
      }

      // Check if user already exists
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

      // Create new user with INACTIVE status and USER role only
      const userData = {
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        status: UserStatus.INACTIVE,
        role: UserRole.USER
      };

      const user = await this.userRepository.create(userData);

      // Generate and send OTP automatically after registration
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await this.userRepository.updateOTP(user._id.toString(), otp, new Date(Date.now() + 5 * 60 * 1000));

      // Send OTP email
      await emailService.sendOTP(email, otp);

      logger.success('anonymous', 'register', `User registered successfully: ${email}, OTP sent`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for OTP verification.',
        data: {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            status: user.status,
            role: user.role
          }
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'register', `Registration failed: ${error.message}`);
      next(error);
    }
  }

  // Login user (email and password only)
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      // Find user by email (include password for authentication)
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Check if user is active
      // Admins and Super Admins don't need address verification
      if (user.role === UserRole.USER && user.status !== UserStatus.ACTIVE) {
        res.status(403).json({
          success: false,
          message: 'Account not active. Please complete your registration first.',
          requiresAddress: true
        });
        return;
      }
      
      // Admins and Super Admins can login with INACTIVE status (they don't need address)
      if ((user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) && user.status !== UserStatus.ACTIVE) {
        // Auto-activate admin/super admin accounts
        await this.userRepository.updateById(user._id.toString(), { status: UserStatus.ACTIVE });
        user.status = UserStatus.ACTIVE;
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Generate JWT token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email, 
          username: user.username,
          role: user.role 
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      // Set HTTP-only cookie
      res.cookie('accessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      logger.success(user.username, 'login', 'User logged in successfully');

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            addresses: user.addresses,
            role: user.role,
            status: user.status
          }
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'login', `Login failed: ${error.message}`);
      next(error);
    }
  }

  // Send OTP to user email (for registration, password reset, or profile update)
  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, purpose, updateData } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User with this email does not exist'
        });
        return;
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Handle different purposes
      const availablePurposes = ['registration', 'password_reset', 'profile_update'];
      
      if (purpose && !availablePurposes.includes(purpose)) {
        res.status(400).json({
          success: false,
          message: `Invalid purpose: '${purpose}'.`,
          availablePurposes: availablePurposes
        });
        return;
      }

      switch (purpose) {
        case 'password_reset':
          // Save OTP for password reset
          await this.userRepository.updateOTP(user._id.toString(), otp, otpExpiry);
          
          // Send password reset email
          const passwordResetEmailSent = await emailService.sendPasswordResetOTP(email, otp);
          
          if (passwordResetEmailSent) {
            logger.success(email, 'sendOtp', `Password reset OTP sent successfully`);
            res.status(200).json({
              success: true,
              message: 'Password reset OTP sent to your email',
              data: {
                email: email,
                purpose: 'password_reset',
                otpExpiry: otpExpiry
              }
            });
          } else {
            logger.error(email, 'sendOtp', 'Failed to send password reset OTP email');
            res.status(206).json({
              success: false,
              message: 'Email service unavailable. Please try again later.',
              data: {
                email: email,
                purpose: 'password_reset',
                otp: otp, // Only for development - remove in production
                otpExpiry: otpExpiry
              }
            });
          }
          break;

        case 'profile_update':
          // Validate update data for profile update
          if (!updateData || typeof updateData !== 'object') {
            res.status(400).json({
              success: false,
              message: 'Update data is required for profile update'
            });
            return;
          }

          // Prevent password updates through profile update
          if (updateData.password) {
            res.status(400).json({
              success: false,
              message: 'Password updates are not allowed through profile update. Use password_reset instead.'
            });
            return;
          }

          // Check if username is being updated and if it's already taken
          if (updateData.username) {
            const existingUser = await this.userRepository.findByUsername(updateData.username);
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
              res.status(409).json({
                success: false,
                message: 'Username is already taken'
              });
              return;
            }
          }

          // Check if email is being updated and if it's already taken
          if (updateData.email) {
            const existingUser = await this.userRepository.findByEmail(updateData.email);
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
              res.status(409).json({
                success: false,
                message: 'Email is already registered'
              });
              return;
            }
          }

          // Save OTP and update data for profile update
          await this.userRepository.updateOTP(user._id.toString(), otp, otpExpiry);
          await this.userRepository.updateById(user._id.toString(), { 
            pendingUpdate: updateData 
          });

          // Send profile update email
          const profileUpdateEmailSent = await emailService.sendProfileUpdateOTP(email, otp);

          if (profileUpdateEmailSent) {
            logger.success(email, 'sendOtp', `Profile update OTP sent successfully`);
            res.status(200).json({
              success: true,
              message: 'OTP sent to your email for profile update verification',
              data: {
                email: email,
                purpose: 'profile_update',
                updateData: updateData,
                otpExpiry: otpExpiry
              }
            });
          } else {
            logger.error(email, 'sendOtp', 'Failed to send profile update OTP email');
            res.status(206).json({
              success: false,
              message: 'Email service unavailable. Please try again later.',
              data: {
                email: email,
                purpose: 'profile_update',
                updateData: updateData,
                otp: otp, // Only for development - remove in production
                otpExpiry: otpExpiry
              }
            });
          }
          break;

        default:
          // Original registration OTP logic
          await this.userRepository.updateOTP(user._id.toString(), otp, otpExpiry);
          
          const emailSent = await emailService.sendOTP(email, otp);
          
          if (emailSent) {
            logger.success(email, 'sendOtp', `OTP sent successfully`);
            res.status(200).json({
              success: true,
              message: 'OTP sent to your email',
              data: {
                email: email,
                purpose: 'registration',
                otpExpiry: otpExpiry
              }
            });
          } else {
            logger.error(email, 'sendOtp', 'Failed to send OTP email');
            res.status(206).json({
              success: false,
              message: 'Email service unavailable. Please try again later.',
              data: {
                email: email,
                purpose: 'registration',
                otp: otp, // Only for development - remove in production
                otpExpiry: otpExpiry
              }
            });
          }
          break;
      }
    } catch (error: any) {
      logger.error(req.body?.email || 'unknown', 'sendOtp', error.message);
      next(error);
    }
  }

  // Reset Password with OTP
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Email, OTP, and new password are required'
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User with this email does not exist'
        });
        return;
      }

      // Verify OTP
      if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await this.userRepository.updatePasswordAndClearOtp(user._id.toString(), hashedPassword);

      logger.success(email, 'resetPassword', 'Password reset successfully');

      res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error: any) {
      logger.error('anonymous', 'resetPassword', error.message);
      next(error);
    }
  }

  // Update Profile with OTP verification (excluding password)
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;
      const { otp } = req.body;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!otp) {
        res.status(400).json({
          success: false,
          message: 'OTP is required'
        });
        return;
      }

      // Verify OTP
      if (!currentUser.otp || currentUser.otp !== otp || !currentUser.otpExpires || currentUser.otpExpires < new Date()) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
        return;
      }

      // Get pending update data
      const userWithPendingData = await this.userRepository.findById(currentUser._id.toString());
      if (!userWithPendingData || !userWithPendingData.pendingUpdate) {
        res.status(400).json({
          success: false,
          message: 'No pending update found. Please request OTP first.'
        });
        return;
      }

      // Apply the update
      const updatedUser = await this.userRepository.updateById(currentUser._id.toString(), userWithPendingData.pendingUpdate);

      // Clear OTP and pending update data
      await this.userRepository.clearProfileUpdateData(currentUser._id.toString());

      logger.success(currentUser.email, 'updateProfile', `Profile updated successfully`);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          _id: updatedUser?._id,
          username: updatedUser?.username,
          email: updatedUser?.email,
          role: updatedUser?.role,
          status: updatedUser?.status,
          updatedFields: Object.keys(userWithPendingData.pendingUpdate)
        }
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'updateProfile', error.message);
      next(error);
    }
  }

  // Logout user
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear the HTTP-only cookie
      res.cookie('accessToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0) // Set to past date to delete cookie
      });

      logger.success(req.user?.username || 'anonymous', 'logout', 'User logged out successfully');

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error: any) {
      logger.error('anonymous', 'logout', `Logout failed: ${error.message}`);
      next(error);
    }
  }

  // Verify OTP and update status to APPROVED
  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      console.log("email", email);
      console.log("otp", otp);
      if (!email || !otp) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP are required'
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if OTP matches and is not expired
      if (!user.otp || user.otp !== otp) {
        res.status(400).json({
          success: false,
          message: 'Invalid OTP'
        });
        return;
      }

      if (!user.otpExpires || user.otpExpires < new Date()) {
        res.status(400).json({
          success: false,
          message: 'OTP expired. Please request a new one.'
        });
        return;
      }

      // Update status to INACTIVE (still needs address) and clear OTP
      const updatedUser = await this.userRepository.updateStatus(user._id.toString(), UserStatus.INACTIVE);
      await this.userRepository.clearOTP(user._id.toString());

      logger.success(user.username, 'verifyOtp', `OTP verified successfully, user needs to provide address`);

      res.status(200).json({
        success: true,
        message: 'OTP verified successfully. Please provide your address details to complete registration.',
        data: {
          _id: updatedUser?._id,
          email: updatedUser?.email,
          status: updatedUser?.status,
          requiresAddress: true
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'verifyOtp', `OTP verification failed: ${error.message}`);
      next(error);
    }
  }

  // Complete registration with address details only
  async completeRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, addresses } = req.body;

      // Validate required fields
      if (!email || !addresses || addresses.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Email and addresses are required'
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if user has verified OTP (status should be INACTIVE but not newly registered)
      if (user.status !== UserStatus.INACTIVE) {
        res.status(400).json({
          success: false,
          message: 'Invalid user status. Please verify OTP first.'
        });
        return;
      }

      // Validate address structure
      const requiredAddressFields = ['street', 'city', 'state', 'postalCode', 'country'];
      for (const address of addresses) {
        for (const field of requiredAddressFields) {
          if (!address[field]) {
            res.status(400).json({
              success: false,
              message: `address.${field} is required`
            });
            return;
          }
        }
      }

      // Mark first address as default if not specified
      if (!addresses.some((addr: any) => addr.isDefault)) {
        addresses[0].isDefault = true;
      }

      // Update user with addresses and activate account
      const updateData = {
        addresses,
        status: UserStatus.ACTIVE
      };

      const updatedUser = await this.userRepository.updateById(user._id.toString(), updateData);

      logger.success(user.username, 'completeRegistration', `Registration completed with address for ${email}`);

      res.status(200).json({
        success: true,
        message: 'Registration completed successfully! Your account is now active.',
        data: {
          _id: updatedUser?._id,
          email: updatedUser?.email,
          username: updatedUser?.username,
          firstName: updatedUser?.firstName,
          lastName: updatedUser?.lastName,
          phoneNumber: updatedUser?.phoneNumber,
          addresses: updatedUser?.addresses,
          status: updatedUser?.status
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'completeRegistration', `Registration completion failed: ${error.message}`);
      next(error);
    }
  }

  // Get user profile
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      logger.success(user.username, 'getProfile', `Profile retrieved for ${user.email}`);

      res.status(200).json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          status: user.status,
          addresses: user.addresses,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        message: 'Profile retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getProfile', `Failed to get profile: ${error.message}`);
      next(error);
    }
  }
}
