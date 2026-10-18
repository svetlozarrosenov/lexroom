import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DocumentsService } from '../services/documents.service.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const document = await this.documentsService.findOne(id);
    if (!document) throw new NotFoundException(`Unknown document ${id}`);
    return document;
  }
}
