import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FindingsController } from './controllers/findings.controller.js';
import { Finding } from './entities/finding.entity.js';
import { FindingsService } from './services/findings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Finding])],
  controllers: [FindingsController],
  providers: [FindingsService],
  exports: [FindingsService, TypeOrmModule],
})
export class FindingsModule {}
