// 70 distinct Round-1 problem statements across 10 website types (7 each).
// Participant N gets PROBLEMS[(N-1) % 70], so 70 participants never share a problem.
// Each entry: [title, what the site is for, who it helps / goal, feature A, feature B]
const TYPES = [
  { type: 'FOOD & DRINK', common: ['Menu/product cards with prices', 'Contact or order form'], items: [
    ['MODERN BAKERY', 'a modern neighbourhood bakery', 'customers discover fresh products and contact the bakery', 'Daily specials strip', 'Opening hours and map section'],
    ['COFFEE ROASTERY', 'a premium coffee roastery', 'visitors explore its story, beans and ways to get in touch', 'Roast-level guide', 'Featured roast call-to-action'],
    ['LOCAL RESTAURANT', 'a family restaurant', 'diners explore the menu and book a table', 'Reservation form', 'Chef specials section'],
    ['JUICE BAR', 'a cold-pressed juice bar', 'health-conscious customers pick drinks and subscribe to weekly boxes', 'Ingredient badges', 'Subscription plans'],
    ['ICE CREAM PARLOUR', 'a colourful ice cream parlour', 'families browse flavours and plan party orders', 'Flavour of the month', 'Party booking form'],
    ['TEA BOUTIQUE', 'a boutique loose-leaf tea shop', 'tea lovers discover blends and brewing tips', 'Brewing guide', 'Gift box section'],
    ['STREET FOOD TRUCK', 'a street food truck', 'hungry people find the menu, today\'s location and catering options', 'Today\'s location banner', 'Catering enquiry form'],
  ]},
  { type: 'HEALTH & FITNESS', common: ['Schedule or services cards', 'Signup or appointment form'], items: [
    ['FITNESS STUDIO', 'a boutique fitness studio', 'visitors explore classes, trainers and memberships', 'Trainer profiles', 'Membership plans'],
    ['YOGA RETREAT', 'a weekend yoga retreat', 'guests learn about programmes and reserve a place', 'Daily retreat itinerary', 'Guest testimonials'],
    ['DENTAL CLINIC', 'a friendly dental clinic', 'patients understand treatments and request appointments', 'Treatment FAQ accordion', 'Doctor team section'],
    ['NUTRITION COACH', 'an online nutrition coach', 'clients see programmes and book a free consultation', 'Before/after success stories', 'Meal plan samples'],
    ['PHYSIOTHERAPY CLINIC', 'a physiotherapy and recovery clinic', 'patients find the right therapy and book sessions', 'Conditions treated list', 'Recovery tips section'],
    ['SWIMMING ACADEMY', 'a swimming academy for kids and adults', 'families compare courses and enrol', 'Level-wise course cards', 'Coach introduction'],
    ['MEDITATION APP', 'a meditation mobile app', 'visitors understand the app and join the waitlist', 'Feature tour', 'Waitlist signup with validation'],
  ]},
  { type: 'TRAVEL & OUTDOORS', common: ['Destination or package cards', 'Enquiry or booking form'], items: [
    ['TRAVEL ESCAPE', 'a modern travel agency', 'users discover destinations and plan their next trip', 'Travel highlights', 'Trip planning call-to-action'],
    ['MOUNTAIN TREK COMPANY', 'a mountain trekking company', 'adventurers choose treks by difficulty and book a guide', 'Difficulty filter', 'Packing checklist'],
    ['BEACH RESORT', 'a seaside beach resort', 'guests explore rooms and amenities and request a stay', 'Room types', 'Amenities grid'],
    ['HERITAGE CITY TOURS', 'a heritage walking tour operator', 'tourists pick tours and learn about the city\'s history', 'Tour timeline', 'Guide profiles'],
    ['BACKPACKER HOSTEL', 'a lively backpacker hostel', 'young travellers compare beds and book quickly', 'Dorm vs private comparison', 'Local tips section'],
    ['WILDLIFE SAFARI', 'a wildlife safari lodge', 'visitors see animals, seasons and safari packages', 'Best-season calendar', 'Animal spotting gallery'],
    ['CAMPING GEAR RENTAL', 'a camping gear rental shop', 'campers choose gear bundles and reserve dates', 'Gear bundles', 'Rental date form'],
  ]},
  { type: 'CREATIVE & MEDIA', common: ['Work or gallery grid', 'Contact form'], items: [
    ['CREATIVE PORTFOLIO', 'a creative designer\'s portfolio', 'clients see work, skills and contact information', 'Skills section', 'Project call-to-action'],
    ['PHOTOGRAPHER PORTFOLIO', 'a professional photographer', 'clients browse galleries and book shoots', 'Category filter for photos', 'Pricing packages'],
    ['INDIE MUSIC BAND', 'an indie music band', 'fans hear about albums and find tour dates', 'Tour dates list', 'Album release section'],
    ['INDIE GAME STUDIO', 'an indie game studio', 'players discover its games and follow development', 'Game showcase cards', 'Dev blog teasers'],
    ['WEDDING PLANNER', 'a boutique wedding planner', 'couples explore services and request a consultation', 'Service packages', 'Real wedding stories'],
    ['FASHION LABEL', 'an emerging fashion label', 'shoppers view collections and join the mailing list', 'Lookbook section', 'Newsletter signup'],
    ['PODCAST SHOW', 'a weekly podcast', 'listeners browse episodes and subscribe', 'Episode list with search', 'Host bios'],
  ]},
  { type: 'RETAIL & SHOPPING', common: ['Product cards with prices', 'Featured collection'], items: [
    ['BOOK STORE', 'a friendly online bookstore', 'readers discover books and learn about the store', 'Category tabs', 'Newsletter form'],
    ['PLANT SHOP', 'a clean plant shop', 'customers browse plants and learn basic care', 'Care tips section', 'Contact form'],
    ['SNEAKER STORE', 'a streetwear sneaker store', 'fans browse drops and filter by brand and size', 'Brand filter', 'Upcoming drops countdown'],
    ['HANDMADE JEWELLERY', 'a handmade jewellery brand', 'shoppers explore collections and the maker\'s story', 'Maker story section', 'Custom order form'],
    ['FURNITURE SHOWROOM', 'a modern furniture showroom', 'home owners browse rooms and request a visit', 'Room-wise collections', 'Visit booking form'],
    ['TOY STORE', 'a playful toy store', 'parents find toys by age group', 'Age-group filter', 'Gift guide'],
    ['MOBILE ACCESSORIES', 'a mobile accessories shop', 'buyers compare cases, chargers and earphones', 'Compare-products table', 'Offer banner'],
  ]},
  { type: 'EDUCATION', common: ['Course or programme cards', 'Enrol or enquiry form'], items: [
    ['CODING BOOTCAMP', 'a beginner coding bootcamp', 'learners see the curriculum and apply', 'Week-by-week curriculum', 'Alumni outcomes'],
    ['LANGUAGE SCHOOL', 'a language school', 'students compare languages and levels and book a trial class', 'Language selector', 'Trial class booking'],
    ['KIDS ART CLASSES', 'a kids\' art studio', 'parents explore classes and see student artwork', 'Student gallery', 'Class schedule table'],
    ['ONLINE TUTORING', 'an online tutoring platform', 'students find tutors by subject', 'Subject filter', 'Tutor profile cards'],
    ['COLLEGE DEPARTMENT', 'a college engineering department', 'prospective students learn about labs, faculty and placements', 'Faculty section', 'Placement highlights'],
    ['COMMUNITY LIBRARY', 'a community library', 'members search the catalogue highlights and join events', 'Book search box', 'Events calendar'],
    ['MUSIC ACADEMY', 'a music academy', 'learners choose instruments and book a demo lesson', 'Instrument cards', 'Demo lesson form'],
  ]},
  { type: 'TECH & STARTUPS', common: ['Feature grid', 'Pricing or plans section'], items: [
    ['PROJECT MANAGEMENT APP', 'a project management SaaS', 'teams understand the product and start a free trial', 'Product screenshot mock', 'Free trial signup'],
    ['FITNESS TRACKER APP', 'a fitness tracking app', 'users see features and download the app', 'Stats dashboard mock', 'Download buttons'],
    ['CYBERSECURITY FIRM', 'a cybersecurity consultancy', 'businesses learn about services and request an audit', 'Threat awareness tips', 'Audit request form'],
    ['AI CHATBOT STARTUP', 'an AI chatbot startup', 'companies see use cases and try a demo', 'Interactive demo chat box', 'Use-case tabs'],
    ['BUDGETING APP', 'a personal budgeting app', 'people learn how it works and sign up', 'Savings calculator', 'How-it-works steps'],
    ['CLOUD HOSTING', 'a cloud hosting provider', 'developers compare plans and sign up', 'Plan comparison toggle', 'Uptime stats'],
    ['DRONE COMPANY', 'a drone services company', 'clients explore services like mapping and photography and request a quote', 'Service use-cases', 'Quote request form'],
  ]},
  { type: 'COMMUNITY & NON-PROFIT', common: ['Mission section', 'Get-involved form'], items: [
    ['ANIMAL SHELTER', 'an animal shelter', 'visitors meet adoptable pets and volunteer', 'Adoptable pet cards', 'Adoption steps'],
    ['FOOD BANK', 'a community food bank', 'donors and volunteers find ways to help', 'Donation amount selector', 'Impact counters'],
    ['TREE PLANTING NGO', 'a tree-planting NGO', 'supporters learn the impact and sponsor a tree', 'Trees planted counter', 'Sponsor a tree form'],
    ['BLOOD DONATION DRIVE', 'a blood donation campaign', 'donors check eligibility and register for a drive', 'Eligibility checklist', 'Drive schedule'],
    ['COLLEGE TECH CLUB', 'a college technical club', 'students see events, projects and join the club', 'Events timeline', 'Member projects'],
    ['CHARITY RUN', 'a city charity run', 'runners register and learn about the cause', 'Race categories', 'Registration form'],
    ['NEIGHBOURHOOD ASSOCIATION', 'a residents\' association', 'residents read notices and report issues', 'Notice board', 'Issue reporting form'],
  ]},
  { type: 'EVENTS', common: ['Schedule or agenda', 'Register or enquiry form'], items: [
    ['TECH SYMPOSIUM', 'a technical symposium', 'students explore events and register', 'Event categories', 'Countdown timer'],
    ['MUSIC FESTIVAL', 'a two-day music festival', 'fans see the line-up and buy passes', 'Line-up by day', 'Ticket tiers'],
    ['EVENT SPACE', 'a modern event venue', 'planners see the space and packages and send an enquiry', 'Package cards', 'Venue gallery'],
    ['HACKATHON', 'a 24-hour hackathon', 'developers learn the tracks and form teams', 'Tracks and prizes', 'Team registration'],
    ['STARTUP PITCH NIGHT', 'a startup pitch night', 'founders and investors see speakers and apply', 'Speaker cards', 'Pitch application form'],
    ['FOOD FESTIVAL', 'a street food festival', 'visitors preview stalls and plan their visit', 'Stall directory with filter', 'Visitor info'],
    ['FILM FESTIVAL', 'a short film festival', 'filmmakers submit entries and audiences see screenings', 'Screening schedule', 'Submission form'],
  ]},
  { type: 'LOCAL SERVICES', common: ['Service cards', 'Booking or quote form'], items: [
    ['PET CARE', 'a trustworthy pet care centre', 'pet owners understand services and request an appointment', 'Care information', 'Appointment call-to-action'],
    ['CAR WASH & DETAILING', 'a car detailing studio', 'drivers compare packages and book a slot', 'Package comparison', 'Before/after slider'],
    ['HOME CLEANING', 'a home cleaning service', 'households pick a plan and request a visit', 'Price estimator', 'Customer reviews'],
    ['REAL ESTATE AGENCY', 'a real estate agency', 'buyers browse listings and contact an agent', 'Listing filter', 'Agent profiles'],
    ['LAW FIRM', 'a small law firm', 'clients understand practice areas and book a consultation', 'Practice areas', 'Consultation form'],
    ['BIKE REPAIR SHOP', 'a bicycle repair shop', 'cyclists see repair prices and book service', 'Repair price list', 'Service tracker mock'],
    ['HAIR & BEAUTY SALON', 'a hair and beauty salon', 'clients explore services and book an appointment', 'Stylist cards', 'Service price menu'],
  ]},
];

const PROBLEMS = [];
for (const t of TYPES) for (const [title, what, goal, fa, fb] of t.items) {
  PROBLEMS.push({
    type: t.type,
    title,
    problem: `Build a polished, responsive website for ${what} that helps ${goal}.`,
    features: ['Responsive navigation', 'Hero section', ...t.common, fa, fb],
  });
}
module.exports = { PROBLEMS };
