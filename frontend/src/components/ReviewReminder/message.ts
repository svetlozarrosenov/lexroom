const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

/** One sentence, shared by the banner and the documents table row tooltip. */
export function reviewReminderMessage(requestedAt: string): string {
  return `The plan had no reviews left when a review was requested on ${dateFormat.format(
    new Date(requestedAt),
  )}. Nothing is queued: remember to run it next month.`;
}
