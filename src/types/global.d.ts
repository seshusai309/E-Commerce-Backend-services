import { IUser } from '@/users/models/User';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
