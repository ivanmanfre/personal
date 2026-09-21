export const founder = {
  name: 'Andrew Hayes',
  company: 'CueVu',
  avatar: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/avatar-andrew-hayes-94.jpg',
  source: 'https://www.linkedin.com/in/andrewhayes-cuevu',
};

export const buyers = [
  {
    id: 'brand', name: 'Brand marketing leads', company: 'Consumer brands',
    reason: 'They commission research and need customer language they can use in campaigns.',
    signal: 'A new campaign, a positioning update, or a public request for customer research.',
    angle: 'Show how a switching story becomes a useful campaign brief.',
    message: 'Hi [name], I work with brands researching why people change products. I put together a short brief for collecting the moment someone decided to switch, and connecting it to a campaign decision. Would a copy be useful for a project you’re working on?',
    post: 'Before you commission another round of customer research, decide where the answers will go.',
  },
  {
    id: 'agency', name: 'Strategy agency founders', company: 'Brand and creative agencies',
    reason: 'Their client work can benefit from original research before the creative brief is written.',
    signal: 'A relevant client win, a research brief, or an advertised brand strategy engagement.',
    angle: 'Show what customer research can add to the next client brief.',
    message: 'Hi [name], I collect stories from people who recently changed brands. I made a short research brief that connects those stories to a creative decision. Do you bring customer research into your strategy projects? Happy to share the brief if it would be useful.',
    post: 'What customer evidence will your team have when it starts the next creative brief?',
  },
  {
    id: 'research', name: 'Customer insight leads', company: 'In-house research teams',
    reason: 'They need a specific research question and a clear use for the findings.',
    signal: 'A category study, a customer insight project, or a request for research participants.',
    angle: 'Show how to scope a study around the moment a customer changed brands.',
    message: 'Hi [name], I work on research with people who recently changed brands. I’ve put together a one-page brief covering the switch, the interview question, and the decision the findings need to support. Is switching behaviour something your team studies?',
    post: 'For your next switching study, write down the decision the findings need to support.',
  },
];

export const postBody = [
  'If your team needs a campaign brief, give the research a campaign question. What happened just before someone decided to change brands? What did they say about it?',
  'At CueVu, we ask people about that moment. The results file keeps their language in their own words.',
  'You can then look for a situation your future customer recognises and decide how to use it in a post, an ad or a landing page.',
  'I’ve put together a one-page brief to help you scope that research. It covers the category, the switching moment and the decision you need to make. Message me for a copy.',
];

export const followups = [
  { day: 'On download', subject: 'Your switching-story research brief', body: 'Here’s the brief. Start with the decision at the bottom of the page. If you know what your team needs to decide, it becomes easier to choose who to hear from and what to ask.' },
  { day: 'A few days later', subject: 'Which decision is the research for?', body: 'Have you picked the decision your research needs to support? A campaign message and a product decision can need different questions. If you reply with the category and the decision, I can suggest where I’d begin.' },
];
