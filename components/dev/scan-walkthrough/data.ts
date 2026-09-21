export const founder = {
  name: 'Andrew Hayes', company: 'CueVu',
  avatar: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/avatar-andrew-hayes-94.jpg',
  source: 'https://www.linkedin.com/in/andrewhayes-cuevu',
};

export const buyers = [
  {
    id: 'brand', name: 'Brand marketing leads', company: 'Consumer brands', decision: 'campaign',
    reason: 'They commission research and need customer language they can use in campaigns.',
    signal: 'A public campaign brief, a positioning project or a request for customer research.',
    angle: 'Connect the moment someone changed brands to the campaign your buyer is planning.',
    qualify: ['Owns brand or campaign decisions at a consumer brand.', 'Has a category and a research question that CueVu can serve.', 'Has a current project or has asked for relevant help.'],
    exclude: 'A marketing title alone is insufficient. Check the category, responsibility and project before adding someone.',
    query: 'Brand Director OR Head of Marketing • consumer brands • customer research',
    message: 'Hi [name], I saw your [verified campaign brief]. Are you gathering customer stories before the messaging is written? I work with people who recently changed brands and put together a brief for collecting the moment they switched. Happy to share it.',
    reply: 'Happy to send it. Which product category is the campaign for? I can point you to the interview questions that fit the decision your team is making.',
    followup: 'One question in the brief may help with the campaign: what was happening when the customer first considered changing brands? Their answer gives you a situation to investigate in the creative.',
    post: 'Before you commission another round of customer research, decide where the answers will go.',
    body: 'For a campaign, I’d start with the situation that made someone consider another brand. Then I’d keep their description beside the message the team wants to test. You can trace the creative back to a customer response.',
  },
  {
    id: 'agency', name: 'Strategy agency founders', company: 'Brand and creative agencies', decision: 'creative',
    reason: 'Their client work can benefit from original research before the creative brief is written.',
    signal: 'A published client win with a brand strategy scope, or a request for research support.',
    angle: 'Bring customer situations and language into the next client brief.',
    qualify: ['Leads a brand, creative or strategy agency.', 'Runs consumer client projects with a research component.', 'Has a relevant brief and can commission research support.'],
    exclude: 'Check the agency’s services and client categories. A founder selling unrelated delivery work is a weak fit.',
    query: 'Founder OR Strategy Director • brand agency • consumer research',
    message: 'Hi [name], I saw [verified client project] in your agency’s work. Do you bring customer research into the creative brief? I collect stories from people who recently changed brands and made a short planner for scoping that research.',
    reply: 'Here’s the planner. Which client category is the brief for? The creative version helps you collect the situation, the customer’s words and the detail you want the team to explore.',
    followup: 'The creative brief section includes a place for the original response beside each proposed angle. It helps the team check what the customer said as the idea develops.',
    post: 'What customer evidence will your team have when it starts the next creative brief?',
    body: 'On a client project, I’d collect the switching situation before the creative workshop. Give the team the response in full, then the phrases you think deserve attention. They can see the context as they develop the idea.',
  },
  {
    id: 'research', name: 'Customer insight leads', company: 'In-house research teams', decision: 'category',
    reason: 'They need a specific research question and a clear use for the findings.',
    signal: 'A public category study, a research brief or a request for participants.',
    angle: 'Scope a study around a recent brand change and a decision the team needs to make.',
    qualify: ['Owns or commissions consumer insight research.', 'Can define the category and eligibility for participants.', 'Has a decision that this type of qualitative research could inform.'],
    exclude: 'Check that switching stories suit the research question. A project requiring market sizing needs a different study design.',
    query: 'Consumer Insights OR Head of Research • brand switching • consumer brands',
    message: 'Hi [name], I came across [verified research brief]. Is brand switching part of the study? I work with people who recently changed brands and made a planner covering participant eligibility, interview questions and how the findings will be used.',
    reply: 'Here’s the planner. Which category and switching period are you studying? Those two choices shape who should take part.',
    followup: 'The planner includes a check on recruitment: ask when the person changed brands and what they used before. You can check the story against your eligibility criteria before including it.',
    post: 'For your next switching study, write down the decision the findings need to support.',
    body: 'I’d define the product category, the brands involved and the period in which the change happened. Keep that definition with the responses so the team can see whose experiences the study covers.',
  },
];
export type Buyer = typeof buyers[number];
export const decisionPlans = {
  campaign: { label: 'Campaign messaging', use: 'A message hypothesis linked to the situation that prompted the switch.', recruit: 'Include people who recently chose a different brand in this category. Record the previous brand, the new brand and when the change happened.', questions: ['What was happening when you first considered another brand?', 'What were you feeling when you decided to change brands?', 'Which part of that experience would you mention to someone in the same situation?'], output: 'Keep the customer’s exact words beside a proposed campaign angle. Record which response supports it and what the team still needs to test.', next: 'Choose one supported message to test in creative. Qualitative responses describe these participants’ experiences; they do not measure market-wide demand.' },
  creative: { label: 'A creative brief', use: 'A customer situation the creative team can explore, with the original response attached.', recruit: 'Recruit recent switchers in the client’s category. Ask enough about the setting to understand where and when their choice happened.', questions: ['Take me back to the moment you considered changing brands. What was happening?', 'What were you feeling when you decided to change brands?', 'What detail would someone need to understand that moment?'], output: 'Build a brief with the setting, the obstacle, the exact customer phrase and a proposed creative direction. Keep proposed copy separate from the customer quotation.', next: 'Review the creative direction with the client. Check permission and context before publishing any customer response.' },
  category: { label: 'A category study', use: 'An initial account of switching situations to investigate across the category.', recruit: 'Define which brands and types of switch qualify. Record the switching date and how participants were recruited so the study’s coverage is explicit.', questions: ['What did you use before, and what did you choose next?', 'What was happening when you first considered the change?', 'What were you feeling when you decided to change brands?'], output: 'Group responses by the situation described, keeping each original response linked. Record contradictory stories and unanswered questions alongside emerging themes.', next: 'Review the themes and decide what further research is needed. This brief does not set sample size or establish how common a theme is in the market.' },
};
export type Decision = keyof typeof decisionPlans;

export const week = [
  { id: 'method', day: 'Monday', format: 'Carousel', title: 'The question behind the story', purpose: 'Show how CueVu starts a customer story.', body: ['At CueVu, the question starts with a moment.', '“What were you feeling when [X-Event] happened?”', 'For someone who changed brands, that event gives the conversation a place to begin. I want to hear what was happening around the choice, and keep their words in the results file.', 'The slides show how I’d bring that material into a research brief.'], source: 'Uses the question recorded in Andrew’s August 13 scan. The application steps are proposed for this preview.' },
  { id: 'decision', day: 'Tuesday', format: 'Text post', title: 'Give the research a decision', purpose: 'Help the selected buyer scope a project.', body: [], source: 'Proposed guidance based on CueVu’s customer research offer. Buyer-specific wording is a draft.' },
  { id: 'results', day: 'Thursday', format: 'Document post', title: 'Inside the results file', purpose: 'Make the research deliverable concrete.', body: ['The results file needs to keep the person’s words intact.', 'When a team reads a story about changing brands, it needs the situation around the decision as well as the phrase that caught its attention.', 'In a proposed review sheet, I’d put the original response beside the category, the switching moment and the decision the team wants to make. A separate space holds the team’s interpretation.', 'That gives the team a way to return to the source when it writes the brief.'], source: 'Recorded source: “Our deliverable is the results file. The authentic human language told in the person’s own words.” No consumer response is reproduced here.' },
  { id: 'planner', day: 'Friday', format: 'Lead magnet post', title: 'Plan your next switching study', purpose: 'Give a potential buyer a useful starting brief.', body: ['I’ve put together a research planner for teams studying why customers change brands.', 'Choose the product category and the decision you need to make. The planner gives you a starting recruitment brief, interview questions and a way to organise the responses.', 'You can use it for a campaign, a creative brief or an initial category study. Your team will still need to agree the sample, recruitment and consent before research begins.', 'Open the planner from the link with this post.'], source: 'New resource concept prepared for Andrew. This post and the planner are unpublished.' },
];
export const slides = [
  { title: 'What happened when they changed brands?', body: 'From the switching moment to the research brief.', label: 'Start with a moment' },
  { title: 'Define the switch.', body: 'Record the category, the previous brand, the new brand and when the change happened.', label: 'Who to hear from' },
  { title: 'Ask about the feeling.', body: '“What were you feeling when [X-Event] happened?”', label: 'Andrew’s recorded question' },
  { title: 'Keep their words.', body: 'Store the original response with its context. The team can return to it as the brief develops.', label: 'The results file' },
  { title: 'Connect it to a decision.', body: 'Choose what the research needs to inform: campaign messaging, a creative brief or a category study.', label: 'Use the findings' },
  { title: 'Write the research brief.', body: 'Use the planner to prepare eligibility criteria, starting questions and a format for the responses.', label: 'A resource to try' },
];
