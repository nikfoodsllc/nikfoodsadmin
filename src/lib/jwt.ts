import jwt from 'jsonwebtoken';

/**
 * JWT Token Payload Interface
 */
export interface JWTPayload {
  userId: string;
  role: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

/**
 * JWT Handler Class
 * Provides JWT token generation and verification functionality
 */
class JWTHandler {
  private static instance: JWTHandler | null = null;
  private secret: string;

  private constructor() {
    const secret = process.env.PRIVATE_KEY;
    if (!secret) {
      throw new Error('PRIVATE_KEY environment variable is not defined');
    }
    this.secret = secret;
  }

  /**
   * Get singleton instance of JWTHandler
   */
  public static getInstance(): JWTHandler {
    if (!JWTHandler.instance) {
      JWTHandler.instance = new JWTHandler();
    }
    return JWTHandler.instance;
  }

  /**
   * Generate a JWT token for an admin user
   * @param userId - User ID from database
   * @param role - User role (default: 'admin' for admin app)
   * @param expiresIn - Token expiration time (default: '7d')
   * @returns JWT token string
   */
  public generateToken(
    userId: string,
    role: 'user' | 'admin' = 'admin',
    expiresIn: string = '7d'
  ): { success: boolean; token?: string; error?: string } {
    try {
      const payload: JWTPayload = {
        userId,
        role,
      };

      const token = jwt.sign(payload, this.secret, {
        expiresIn: expiresIn,
        algorithm: 'HS256',
      } as jwt.SignOptions);

      return {
        success: true,
        token,
      };
    } catch (error) {
      console.error('Error generating JWT token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify and decode a JWT token
   * @param token - JWT token string
   * @returns Decoded payload or error
   */
  public verifyToken(token: string): {
    success: boolean;
    payload?: JWTPayload;
    error?: string;
  } {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      return {
        success: true,
        payload: decoded,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token has expired',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid token',
        };
      }

      console.error('Error verifying JWT token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Decode token without verification (useful for reading expired tokens)
   * @param token - JWT token string
   * @returns Decoded payload or null
   */
  public decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  /**
   * Refresh a token (generate new token with same userId and role)
   * @param token - Existing JWT token
   * @param expiresIn - New expiration time (default: '7d')
   * @returns New JWT token
   */
  public refreshToken(
    token: string,
    expiresIn: string = '7d'
  ): { success: boolean; token?: string; error?: string } {
    try {
      // Decode without verification to get payload (even if expired)
      const decoded = this.decodeToken(token);

      if (!decoded || !decoded.userId) {
        return {
          success: false,
          error: 'Invalid token payload',
        };
      }

      // Generate new token with same userId and role
      return this.generateToken(decoded.userId, decoded.role, expiresIn);
    } catch (error) {
      console.error('Error refreshing JWT token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export lazy singleton instance
let jwtHandlerInstance: JWTHandler | null = null;

export const jwtHandler = {
  getInstance: () => {
    if (!jwtHandlerInstance) {
      jwtHandlerInstance = JWTHandler.getInstance();
    }
    return jwtHandlerInstance;
  },
  generateToken: (userId: string, role?: 'user' | 'admin', expiresIn?: string) => {
    const instance = JWTHandler.getInstance();
    return instance.generateToken(userId, role, expiresIn);
  },
  verifyToken: (token: string) => {
    const instance = JWTHandler.getInstance();
    return instance.verifyToken(token);
  },
  decodeToken: (token: string) => {
    const instance = JWTHandler.getInstance();
    return instance.decodeToken(token);
  },
  refreshToken: (token: string, expiresIn?: string) => {
    const instance = JWTHandler.getInstance();
    return instance.refreshToken(token, expiresIn);
  },
};

// Also export the class for advanced usage
export { JWTHandler };
