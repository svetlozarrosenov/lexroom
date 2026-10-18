import { Controller, Delete, HttpCode } from '@nestjs/common';
import { FindingsService } from '../services/findings.service.js';

@Controller('findings')
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Delete()
  @HttpCode(204)
  removeAll() {
    return this.findingsService.removeAll();
  }
}
