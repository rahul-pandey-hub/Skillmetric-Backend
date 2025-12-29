import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Sanitizes MongoDB queries to prevent NoSQL injection attacks
 * Removes MongoDB operator keywords ($where, $ne, $gt, etc.) from user input
 */
@Injectable()
export class MongoSanitizePipe implements PipeTransform {
  private readonly dangerousOperators = [
    '$where',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
    '$and',
    '$or',
    '$not',
    '$nor',
    '$exists',
    '$type',
    '$mod',
    '$regex',
    '$text',
    '$expr',
    '$jsonSchema',
    '$all',
    '$elemMatch',
    '$size',
  ];

  transform(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item));
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private sanitizeString(value: string): string {
    // Check if string contains MongoDB operators
    for (const operator of this.dangerousOperators) {
      if (value.includes(operator)) {
        throw new BadRequestException(
          'Invalid input: MongoDB operators are not allowed',
        );
      }
    }
    return value;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Check if key itself is a MongoDB operator
        if (this.dangerousOperators.includes(key)) {
          throw new BadRequestException(
            `Invalid field name: "${key}" is not allowed`,
          );
        }

        // Recursively sanitize the value
        sanitized[key] = this.transform(obj[key]);
      }
    }

    return sanitized;
  }
}

/**
 * Less strict sanitizer that allows MongoDB operators in specific contexts
 * (e.g., when building queries in admin interfaces)
 */
@Injectable()
export class MongoSanitizePermissivePipe implements PipeTransform {
  transform(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Only sanitize $where operator (most dangerous)
    const stringValue = JSON.stringify(value);
    if (stringValue.includes('$where')) {
      throw new BadRequestException('$where operator is not allowed');
    }

    return value;
  }
}
