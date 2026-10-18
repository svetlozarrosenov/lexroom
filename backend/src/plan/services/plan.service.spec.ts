import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity.js';
import { PlanService } from './plan.service.js';

describe('PlanService', () => {
  let service: PlanService;
  let repo: Repository<Plan>;

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
    repo = moduleRef.get(getRepositoryToken(Plan));
  });

  it('creates the plan with 10 reviews, all remaining, on first use', async () => {
    const plan = await service.current();

    expect(plan).toMatchObject({ max: 10, remaining: 10 });
  });

  it('keeps a single plan row', async () => {
    await service.current();
    await service.current();

    expect(await repo.count()).toBe(1);
  });

  it('consume takes one review and reports success', async () => {
    expect(await service.consume()).toBe(true);
    expect((await service.current()).remaining).toBe(9);
  });

  it('consume refuses and changes nothing once the plan is used up', async () => {
    await repo.save(repo.create({ max: 10, remaining: 0 }));

    expect(await service.consume()).toBe(false);
    expect((await service.current()).remaining).toBe(0);
  });

  it('removeAll deletes the plan so the next use starts full again', async () => {
    await repo.save(repo.create({ max: 10, remaining: 2 }));

    await service.removeAll();

    expect(await repo.count()).toBe(0);
    expect((await service.current()).remaining).toBe(10);
  });

  it('returns the stored remaining count', async () => {
    await repo.save(repo.create({ max: 10, remaining: 3 }));

    expect((await service.current()).remaining).toBe(3);
  });
});
