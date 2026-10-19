import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';
import type { ReviewEvent } from '../review-event.js';

/** In-process bus for review changes, consumed by the SSE endpoint. */
@Injectable()
export class ReviewEventsService {
  private readonly events$ = new Subject<ReviewEvent>();

  emit(event: ReviewEvent): void {
    this.events$.next(event);
  }

  /** Events of every document in the workspace. */
  all(): Observable<ReviewEvent> {
    return this.events$.asObservable();
  }

  forDocument(documentId: string): Observable<ReviewEvent> {
    return this.events$.pipe(filter((event) => event.documentId === documentId));
  }
}
