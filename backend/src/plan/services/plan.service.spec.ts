import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity.js';
import { PlanService } from './plan.service.js';

describe('PlanService', () => {
  let service: PlanService;
  let plans: Repository<Plan>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Plan],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Plan]),
      ],
      providers: [PlanService],
    }).compile();

    service = moduleRef.get(PlanService);
    plans = moduleRef.get(getRepositoryToken(Plan));
  });

  it('allows 10 reviews by default', async () => {
    expect(await service.max()).toBe(10);
  });

  it('keeps a single plan row', async () => {
    await service.max();
    await service.max();

    expect(await plans.count()).toBe(1);
  });

  it('returns the allowance of the stored row', async () => {
    await plans.save(plans.create({ max: 3 }));

    expect(await service.max()).toBe(3);
  });

  it('removeAll deletes the plan row so the next use starts from the default allowance', async () => {
    await plans.save(plans.create({ max: 3 }));

    await service.removeAll();

    expect(await plans.count()).toBe(0);
    expect(await service.max()).toBe(10);
  });
});
