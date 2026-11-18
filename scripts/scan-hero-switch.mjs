/** The V2 scan layout is on only when the build variable is exactly '1'. Unset, '0' or anything else keeps today's layout.
 *  Shared by the app (ScanStoryReport) and the prerender script so both read the switch the same way. */
export const scanHeroOn = (value) => value === '1';
