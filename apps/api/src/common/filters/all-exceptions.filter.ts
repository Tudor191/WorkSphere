import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtru global — orice eroare neprinsă ajunge aici, cu un format JSON
 * consistent și logare (cerință explicită: "Logging" în secțiunea API).
 * Erorile necunoscute (non-HttpException) sunt mascate cu un mesaj generic
 * către client (nu expunem stack trace-uri sau detalii interne), dar
 * logate complet server-side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { message: 'A apărut o eroare internă. Încearcă din nou mai târziu.' };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof body === 'string' ? { message: body } : body),
    });
  }
}
