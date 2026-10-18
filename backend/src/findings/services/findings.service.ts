import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finding } from '../entities/finding.entity.js';

@Injectable()
export class FindingsService {
  constructor(
    @InjectRepository(Finding)
    private readonly findings: Repository<Finding>,
  ) {}

  async removeAll(): Promise<void> {
    await this.findings.clear();
  }
}
