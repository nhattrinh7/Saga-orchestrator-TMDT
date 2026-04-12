import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message: any = 'Internal server error'
    let errors: any = undefined

    // Nếu là HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message

        // Nếu là lỗi validation từ Zod thì sẽ có .errors
        if ((exceptionResponse as any).errors) {
          errors = (exceptionResponse as any).errors
          status = HttpStatus.UNPROCESSABLE_ENTITY
        }
      }
      // Nếu là Error thường
    } else if (exception instanceof Error) {
      message = exception.message
    }

    // Log error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    )

    // Response
    const responseBody: any = {
      statusCode: status,
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    // Thêm errors nếu có (từ Zod validation)
    if (errors) {
      responseBody.errors = errors
    }

    response.status(status).json(responseBody)
  }
}
