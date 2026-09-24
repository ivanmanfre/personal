import type { StoryKind } from './connectedModel';

export interface SampleSlide { title: string; body: string; points?: string[]; note?: string; visual?: 'review' | 'question' | 'brief'; }
export const samplePlans: Record<Exclude<StoryKind, 'custom'>, {
  brand: string; post: string; slides: SampleSlide[]; magnet: string;
  plainPost: string; magnetPost: string;
  message: string; reply: string; next: string; subject: string; email: string;
}> = {
  creative: {
    brand: 'neu',
    post: 'We lost a project over access to our first internal review.\n\nWe offered a sync an hour later, the next morning, the following day. The client still wanted to be in that first meeting.\n\nI’d put that question in the brief before booking the team: when does the client first see the work?\n\nThe slides show how I’d agree on it before the work begins.',
    slides: [
      { title: 'We lost a project over one meeting.', body: 'The client wanted to join our first internal review. We wanted the team to work through the ideas together first.', visual: 'review' },
      { title: 'We offered another time.', body: 'An hour after our meeting. The next morning. The following day. We offered each of those options and still lost the project. Changing the time didn’t resolve the disagreement about who could join the first review.', note: 'The review access was the issue.' },
      { title: 'I’d raise it while booking the team.', body: 'A producer commissioning independent talent needs to know when the client will see the work. Put that decision in the brief alongside the deliverables. Both sides can agree on the arrangement before anyone commits to the project.', visual: 'brief' },
      { title: 'Name the decision for each review.', body: 'For the first client review, agree whether you’re choosing a direction or checking finished work. Say what the team will show and what is still being developed. The producer can then invite the people needed for that decision.', note: 'A proposed first review: choose the direction.' },
      { title: 'Agree on how feedback comes back.', body: 'Ask the client to name one person who collects their comments. If two requests conflict, have that person resolve them before the team revises. Include the feedback date in the schedule so the next delivery has time set aside.', visual: 'brief' },
      { title: 'Agree on access before booking.', body: 'Before you commission the team, put the review plan in the brief. Say when the client will first join and what they’ll decide. Ask the rep and the client to confirm it while there’s still time to change the arrangement.', note: 'Who joins the first review? Put the answer in the brief.' },
    ],
    magnet: 'The project room',
    plainPost: 'When I introduce a creative team, my name goes with them.\n\nA team I knew had tried to get into a brand through cold pitching. They were turned down. I heard about it through someone on the inside.\n\nI kept thinking that, if I represented them, I could have called and asked him to give them a shot. And I would have stayed involved after that introduction.\n\nIf you’re commissioning talent, ask the rep who will pick up the phone when something gets difficult after the team is booked.',
    magnetPost: 'A production house sent me a spec budget with 5% of the total going to creative development.\n\nAt €100,000, that would leave €5,000 for the idea. Before comparing the total with another bid, I’d ask what that line includes. Concept development? Art direction on the shoot? Revisions?\n\nI put together a project planner for producers. Choose the type of project and use the deliverables, review decisions and quote questions to write a brief.\n\nSend the same scope to each team you’re considering. You’ll have something concrete to compare when the quotes come back.',
    message: 'Hi Alex, saw you requested the project planner. Are you putting a team together for a campaign at the moment?',
    reply: 'Yes, a beauty launch. We have a producer but still need an art director.',
    next: 'What’s the launch date and the fee range for the art director? I can check whether we have someone who fits.',
    subject: 'Which part of that campaign did they make?',
    email: 'Hi Alex,\n\nIf you’re choosing between creative teams, ask each one to take you through a project close to your brief.\n\nWho came up with the idea? Who directed the work? Which people would be on your project, and are they available for your dates?\n\nA campaign in a portfolio can involve several teams. Those answers help you understand what you’re actually booking.\n\nSend the same brief to the teams you shortlist so their quotes cover the same work.\n\nLuiza',


  },
  research: {
    brand: 'CueVu',
    post: '“What were you feeling when you decided to switch?”\n\nThat’s the question I’d use for a brand-switching study.\n\nI want to hear what happened around the decision and what the person tried before it. I’d keep their exact words beside the campaign brief so the team can check what the customer actually said.\n\nThe slides show how I’d set up that study. The question studio has examples you can adapt.',
    slides: [
      { title: 'What made your customer switch?', body: 'Ask them to take you back to the decision. Their account of that day gives you a place to start the research.', visual: 'question' },
      { title: 'Choose the event before the question.', body: 'For a switching study, define the change you want to understand. It could be a move between brands in your category. Ask about a recent decision that the person can describe, and record when it happened with the answer.', note: 'Interview question: “What were you feeling when you decided to switch?”' },
      { title: 'Recruit people who made that change.', body: 'Check that each participant used an alternative before choosing the new brand. Ask which products they used and when they changed. Keep those answers with the response so your team knows whose experience it is reading.', visual: 'brief' },
      { title: 'Let people answer in their own words.', body: 'Send the question with the event clearly named. Give participants space to describe what they felt and what was happening. Keep their responses intact in the results file so the campaign team can read each person’s account in context.', visual: 'question' },
      { title: 'Keep the quote beside its context.', body: 'Save the exact phrase with the event it describes. Look across the responses for repeated reasons and exceptions. If one person mentions a problem, keep that observation at the level the evidence supports when sharing it with the campaign team.', note: 'Working file: quote → event → possible message → evidence needed.' },
      { title: 'Write the question around their decision.', body: 'Agree on what the campaign team needs to learn before collecting responses. The question studio includes examples of events and participant criteria. You can use it to work out who belongs in the study and what you’ll ask them.', note: 'Customer question studio · CueVu' },
    ],
    magnet: 'Customer question studio',
    plainPost: 'Our deliverable is the results file.\n\nThe person reading it should be able to see what we asked and the words people used in reply.\n\nIf a customer describes the day they switched brands, keep that account together. The campaign team needs the context around a phrase before deciding to use it.\n\nI’d put the original response beside any proposed copy. You can then check whether the draft still says what the person meant, and ask permission before publishing their words.',
    magnetPost: '“What were you feeling when it happened?”\n\nBefore you send that question, decide which event you want people to describe.\n\nFor a brand-switching study, that could be the purchase that replaced their previous brand. Your panel needs to have made that change.\n\nI put together a question studio with example events, participant criteria and the wording to send. You can start with one of the examples and copy the question.',

    message: 'Hi Alex, saw you requested the question studio. Which customer decision are you looking into?',
    reply: 'Why people switch skincare brands. We’re planning a launch and need to agree on the campaign angle.',
    next: 'When does the team need the findings? I can help work out who to ask and whether a pilot would fit the launch.',
    subject: 'Keep the response beside the campaign draft',
    email: 'Hi Alex,\n\nWhen a customer phrase makes it into a campaign draft, keep the original response beside it.\n\nDid the person describe why they switched, or a problem they ran into afterwards? Does your draft still mean what they said?\n\nSave the event and the question with the quote. The next person reviewing the copy can then check it against the response.\n\nAndrew',

  },
};
