import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './interfaces/ai-provider.interface.js';
import { DOCUMENTS_FILE, FakeAiProvider } from './providers/fake-ai.provider.js';

const DEFAULT_DOCUMENTS_FILE = '../samples/documents.json';

@Module({
  providers: [
    { provide: DOCUMENTS_FILE, useValue: process.env.DOCUMENTS_FILE ?? DEFAULT_DOCUMENTS_FILE },
    { provide: AI_PROVIDER, useClass: FakeAiProvider },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
