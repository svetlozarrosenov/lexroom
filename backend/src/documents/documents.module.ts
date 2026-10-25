import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './controllers/documents.controller.js';
import { Document } from './entities/document.entity.js';
import {
  DOCUMENTS_SOURCE_FILE,
  DocumentsService,
} from './services/documents.service.js';

const DEFAULT_DOCUMENTS_FILE = '../samples/documents.json';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentsController],
  providers: [
    {
      provide: DOCUMENTS_SOURCE_FILE,
      useValue: process.env.DOCUMENTS_FILE ?? DEFAULT_DOCUMENTS_FILE,
    },
    DocumentsService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
