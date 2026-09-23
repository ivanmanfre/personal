import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryEdition} from './types';
/** Third review candidate: a different offer and a recorded zero-match audit. */
export function simmerDraft(f:JourneyFixture):StoryEdition|null {
 if(f.slug!=='nerijus-danilevicius-43'||f.founder.name!=='Nerijus Danilevicius'||f.founder.company!=='Simmer')return null;
 return {
  version:1,reviewStatus:'draft',slug:f.slug,founderName:f.founder.name,companyName:f.founder.company,brand:'Simmer',art:'custom',
  post:'Fonten vi valgte for Hartnet heter Writer, fra Pangram Pangram.\n\nDen er inspirert av fransk renessanse. Vi valgte den for at uttrykket skulle passe til kjøkkenene Hartnet lager.\n\nNår du vurderer en ny identitet, be designeren vise skriften der kundene faktisk møter den. På telefonen. I en overskrift. I en produktbeskrivelse.\n\nHer er hvordan jeg ville vurdert valget før det blir låst.',
  plainPost:'Når vi leverer en side i Webflow, skal kunden kunne jobbe videre med den.\n\nOppdatere tekst. Bytte bilder. Legge til sider.\n\nDet bør være en del av leveransen, med tid til å vise hvor og hvordan.\n\nFør du bestiller en ny nettside, skriv ned de endringene teamet ditt gjør oftest. Be om å få prøve dem under overleveringen.\n\nDa ser du om siden faktisk fungerer for dem som skal bruke den.',
  slides:[
   {title:'En skrift som passer til det dere lager.',body:'For Hartnet valgte vi Writer fra Pangram Pangram. Uttrykket skulle passe til håndverket i kjøkkenene.'},
   {title:'Start med noe kunden kjenner igjen.',body:'Legg et bilde av produktet ved siden av typografien. Beskriv hva som binder dem sammen. Bruk konkrete egenskaper ved produktet.'},
   {title:'Vis den i den virkelige teksten.',body:'En kort overskrift kan se bra ut nesten overalt. Prøv også et langt produktnavn og en vanlig beskrivelse. De skal fungere i samme system.'},
   {title:'Se på telefonen også.',body:'Les overskriften og beskrivelsen på en liten skjerm. Se om linjene brytes på steder som gjør teksten lett å forstå.'},
   {title:'Avklar hva teamet trenger.',body:'Hvilke vekter skal brukes? Hvem trenger lisens? Hvor skal skriften fungere utenfor nettsiden? Ta med svarene i overleveringen.'},
   {title:'Be om å se valget i bruk.',body:'Før du godkjenner identiteten, se en side med deres egen tekst og egne bilder. Da vurderer dere noe dere faktisk skal bruke.'},
  ],
  magnet:'Plan for overlevering',keyword:'PLAN',
  magnetPost:'Hvem oppdaterer nettsiden når prosjektet er ferdig?\n\nDet er et spørsmål å stille før dere bestiller den.\n\nJeg har laget en liten prosjektmal for å avtale hva teamet skal kunne endre selv, hva byrået skal levere og hvordan dere prøver det sammen.\n\nVelg nettside eller ny identitet. Kopier utkastet og tilpass det før dere ber om tilbud.',
  message:'Hei Alex, så du ba om planen for overlevering. Skal dere bygge ny nettside, eller gjøre den dere har enklere å oppdatere?',
  reply:'Vi skal bygge ny side. Markedsteamet må kunne legge til kundecaser selv.',
  next:'Hvilke sider trenger dere, og når må de være klare? Da kan vi se hva som bør være med i prosjektet.',
  subject:'La den som skal oppdatere siden prøve først',
  email:'Hei Alex,\n\nVelg én vanlig oppgave før dere overtar den nye nettsiden. For eksempel å publisere en kundecase.\n\nLa personen som skal gjøre jobben prøve med ekte tekst og bilder. Se hvor de stopper opp.\n\nBruk det dere finner til å justere malene og opplæringen før prosjektet avsluttes.\n\nDa får teamet øvd på arbeidet de faktisk skal gjøre.\n\nNerijus',
  contentHeading:'Show founders what working with you changes.',contentWhy:'Use your project decisions to explain the value of the work.',magnetWhy:'A lead magnet for teams commissioning a website or identity. It helps them agree what they will receive.',
  researchNote:'Your posts about Hartnet’s typography and handing over a Webflow site shape these samples.',
  sourceQuote:f.samples.posts?.find(p=>p.source_quote?.includes('Fonten vi valgte'))?.source_quote||'',
  segments:[{label:'Founders planning a new website',note:'Check the planned work, decision maker and timing.'},{label:'Marketing leads updating an identity',note:'Look for a named project. A hiring post alone does not confirm a budget.'}],
  buyerRole:'Marketing lead',coldTrigger:'A company announces a website project.',coldMessage:'Hei Alex, så at dere planlegger ny nettside. Hvem skal oppdatere innholdet etter lansering? Vi jobber med identitet og Webflow. Jeg kan sende et eksempel på hvordan vi legger opp overleveringen.',
  newsletterNote:'notes on brand and website projects',nurtureNote:'A note on testing the handover with your own team.',
  resource:{title:'Hva skal teamet kunne gjøre selv?',mode:'document',brand:{surface:'#fffef9',ink:'#0a0a09',accent:'#ffe894'},options:[
   {label:'Nettside',title:'Utkast til overlevering av nettside',sections:[{heading:'En oppgave å prøve sammen',body:'Publiser én kundecase med ekte tekst og bilder. La personen som skal eie innholdet gjøre oppgaven mens byrået følger med.'},{heading:'Dette inngår i leveransen',body:'Avtal sidemaler, innholdsfelter, tilgang og en kort gjennomgang. Skriv hvem som eier domene, publisering og løpende abonnement.'},{heading:'Slik vet dere at den er klar',body:'Teamet kan oppdatere tekst og bilder, forhåndsvise endringen og publisere den. Avtal hvordan dere retter feil som oppdages ved overlevering.'},{heading:'Fyll inn før dere ber om tilbud',body:'Navn på innholdsansvarlig: ____\nSidemaler som trengs: ____\nDato for opplæring: ____\nSupport etter levering: ____'}]},
   {label:'Identitet',title:'Utkast til overlevering av identitet',sections:[{heading:'Prøv identiteten på eget innhold',body:'Velg en nettside og en presentasjon teamet faktisk bruker. Se hvordan typografi, farger og bilder fungerer med deres egen tekst.'},{heading:'Dette inngår i leveransen',body:'Avtal logofiler, fontlisenser, fargeverdier og redigerbare maler. Skriv hvilke filformater dere trenger og hvem som får tilgang.'},{heading:'Slik vet dere at den er klar',body:'En i teamet lager en ny side i presentasjonen uten hjelp fra designeren. Bruk spørsmålene som dukker opp til å forbedre veiledningen.'},{heading:'Fyll inn før dere ber om tilbud',body:'Ansvarlig for identiteten: ____\nMaler teamet trenger: ____\nLisenser og eierskap: ____\nDato for gjennomgang: ____'}]},
  ]},
  cover:{lines:['Hvem tar over','etter lansering?'],left:'Prosjektet',right:'Overleveringen',details:['Hvem oppdaterer?','Hva skal leveres?']},
  flow:{messages:['We need a new website our team can update.','The project budget is €12,000.','We want to launch in three months.','Yes, let’s discuss the pages and handover.'],checks:[{label:'Project',value:'Website and handover'},{label:'Example budget',value:'€12,000'},{label:'Timing',value:'Three months'}],signal:'Website project announced',callTitle:'Website project call',brief:'Website · €12,000 example budget · three months'},
 };
}
