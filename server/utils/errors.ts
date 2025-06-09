import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * カスタムエラークラス - HTTPステータスコードと詳細情報を持つ
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Error.captureStackTrace が存在する場合のみ呼び出し
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * よく使われるエラーのファクトリー関数
 */
export class ErrorFactory {
  static notFound(entity: string, id?: string): AppError {
    const message = id ? `${entity} with ID '${id}' not found` : `${entity} not found`;
    return new AppError(message, 404);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, true, details);
  }

  static unauthorized(message: string = 'Unauthorized access'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, true, details);
  }

  static internal(message: string, details?: unknown): AppError {
    return new AppError(message, 500, true, details);
  }

  static validationError(details: unknown): AppError {
    return new AppError('Validation failed', 400, true, details);
  }
}

/**
 * Prismaエラーをアプリケーションエラーに変換
 */
export function convertPrismaError(error: any): AppError {
  if (error.code === 'P2002') {
    return ErrorFactory.conflict('Resource already exists', {
      field: error.meta?.target,
      code: error.code,
    });
  }

  if (error.code === 'P2025') {
    return ErrorFactory.notFound('Resource');
  }

  if (error.code === 'P2003') {
    return ErrorFactory.badRequest('Foreign key constraint failed', {
      field: error.meta?.field_name,
      code: error.code,
    });
  }

  // その他のPrismaエラー
  return ErrorFactory.internal('Database operation failed', {
    code: error.code,
    message: error.message,
  });
}

/**
 * グローバルエラーハンドリングミドルウェア
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let appError: AppError;

  // AppErrorの場合はそのまま使用
  if (error instanceof AppError) {
    appError = error;
  }
  // Prismaエラーの場合は変換
  else if (error.name === 'PrismaClientKnownRequestError') {
    appError = convertPrismaError(error);
  }
  // Zodバリデーションエラー
  else if (error.name === 'ZodError') {
    appError = ErrorFactory.validationError(error);
  }
  // その他の予期しないエラー
  else {
    appError = ErrorFactory.internal('Internal server error', {
      originalMessage: error.message,
      stack: error.stack,
    });
  }

  // ログ出力
  const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error:', {
    message: appError.message,
    statusCode: appError.statusCode,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    details: appError.details,
    stack: appError.stack,
  });

  // クライアントへのレスポンス
  const responseBody: {
    error: string;
    statusCode: number;
    path?: string;
    timestamp?: string;
    details?: unknown;
  } = {
    error: appError.message,
    statusCode: appError.statusCode,
  };

  // 開発環境では詳細情報を含める
  if (process.env.NODE_ENV === 'development') {
    responseBody.path = req.path;
    responseBody.timestamp = new Date().toISOString();
    if (appError.details) {
      responseBody.details = appError.details;
    }
  }

  res.status(appError.statusCode).json(responseBody);
}

/**
 * 非同期ルートハンドラーをラップしてエラーを自動的にcatchする
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404ハンドラー
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = ErrorFactory.notFound('Route', `${req.method} ${req.path}`);
  next(error);
}