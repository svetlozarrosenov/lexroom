import { ReviewStatus } from '../review-status.enum.js';
import type { ReviewEvent } from '../review-event.js';
import { ReviewEventsService } from './review-events.service.js';

describe('ReviewEventsService', () => {
  it('all() delivers the events of every document', () => {
    const bus = new ReviewEventsService();
    const received: ReviewEvent[] = [];
    bus.all().subscribe((e) => received.push(e));

    bus.emit({ type: 'finding', documentId: 'doc-a', reviewId: 'r1' });
    bus.emit({ type: 'finding', documentId: 'doc-b', reviewId: 'r2' });

    expect(received.map((e) => e.documentId)).toEqual(['doc-a', 'doc-b']);
  });

  it('delivers only the events of the subscribed document, in order', () => {
    const bus = new ReviewEventsService();
    const received: ReviewEvent[] = [];
    bus.forDocument('doc-a').subscribe((e) => received.push(e));

    bus.emit({ type: 'status', documentId: 'doc-a', reviewId: 'r1', status: ReviewStatus.Running });
    bus.emit({ type: 'finding', documentId: 'doc-b', reviewId: 'r2' });
    bus.emit({ type: 'finding', documentId: 'doc-a', reviewId: 'r1' });

    expect(received).toEqual([
      { type: 'status', documentId: 'doc-a', reviewId: 'r1', status: ReviewStatus.Running },
      { type: 'finding', documentId: 'doc-a', reviewId: 'r1' },
    ]);
  });
});
