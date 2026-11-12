// Demo brand: "Aranya Naturals" — a FICTIONAL skincare brand made up for testing Verity.
// None of these products, prices, studies or people are real.

export const PRODUCTS = [
  { id: "P1", name: "Neem Purifying Cleanser", size: "100 ml", keywords: "neem|face wash|facewash|cleanser" },
  { id: "P2", name: "Aloe Calm Gel", size: "150 ml", keywords: "aloe" },
  { id: "P3", name: "Turmeric Glow Serum", size: "30 ml", keywords: "turmeric|haldi|serum" },
  { id: "P4", name: "Sandalwood Night Cream", size: "50 g", keywords: "sandalwood|night cream" },
  { id: "P5", name: "Sun Shield SPF 50 Gel", size: "50 g", keywords: "sun shield|sunscreen|spf" },
];

type Sev = "blocker" | "major" | "minor";
export interface RuleSeed {
  id: string;
  category: "voice" | "messaging" | "claims" | "visual" | "accessibility" | "disclosure" | "confidential";
  title: string;
  body: string;
  do_example?: string;
  dont_example?: string;
  severity: Sev;
}

export const RULES: RuleSeed[] = [
  // Voice
  { id: "V-01", category: "voice", title: "Warm, clear and honest", body: "Write like a friend who knows skincare: warm, clear, honest.", do_example: "Here's what neem actually does for oily skin.", dont_example: "Unlock your skin's ultimate potential!", severity: "minor" },
  { id: "V-02", category: "voice", title: "Calm, never pushy", body: "Calm, never pushy. No all-caps urgency. Max one \"!\" and three emojis per post.", do_example: "Try it today and see the difference in a few weeks.", dont_example: "HURRY!! Grab it NOW before it's gone!!!", severity: "major" },
  { id: "V-03", category: "voice", title: "Talk to \"you\"", body: "Use \"you\" and \"your skin\". Avoid \"consumers\" and \"users\".", do_example: "Your skin will thank you.", dont_example: "Users report improvement.", severity: "minor" },
  { id: "V-04", category: "voice", title: "Friendly, not casual", body: "Be friendly, not casual.", severity: "minor" },
  { id: "V-05", category: "voice", title: "Short sentences", body: "Short sentences. Aim for a reading level a 14-year-old can follow.", severity: "minor" },
  { id: "V-06", category: "voice", title: "Never shame skin", body: "Never shame skin. Don't use \"flaws\", \"ugly\" or \"problem skin\".", do_example: "Blemish-prone skin", dont_example: "Fix your ugly acne", severity: "major" },
  { id: "V-07", category: "voice", title: "Hinglish only on Instagram", body: "Hindi/Hinglish words are okay in Instagram captions, not in press releases or emails.", do_example: "Neem ka kamaal, naturally. (Instagram)", dont_example: "Hinglish in a press release", severity: "minor" },
  { id: "V-08", category: "voice", title: "Don't mock other brands", body: "Don't mock competitors or other brands.", severity: "major" },
  // Messaging
  { id: "M-01", category: "messaging", title: "Plant-powered", body: "Real plant ingredients, named clearly (neem, aloe, turmeric, sandalwood).", severity: "minor" },
  { id: "M-02", category: "messaging", title: "Honest results", body: "Talk about realistic results over weeks, never overnight.", severity: "major" },
  { id: "M-03", category: "messaging", title: "Premium but accessible", body: "Premium but accessible.", severity: "minor" },
  { id: "M-04", category: "messaging", title: "Made for Indian skin", body: "Made for Indian skin and weather: humidity, sweat, sun, pollution.", severity: "minor" },
  // Claims
  { id: "C-1.1", category: "claims", title: "Results must match an approved fact", body: "Every result claim (e.g. \"clearer skin\", \"reduces blemishes\") must match an approved fact, including its timeframe.", severity: "blocker" },
  { id: "C-1.2", category: "claims", title: "No overnight promises", body: "Never promise results in days or \"overnight\" unless an approved fact says so.", severity: "blocker" },
  { id: "C-2.1", category: "claims", title: "Avoid medical claims", body: "Avoid medical claims.", severity: "major" },
  { id: "C-2.2", category: "claims", title: "No cure / treat / heal", body: "Never say a product \"cures\", \"treats\", \"heals\" or \"prevents\" any condition.", severity: "blocker" },
  { id: "C-3.1", category: "claims", title: "Numbers must match facts", body: "Ingredient percentages and other numbers must match approved facts exactly.", severity: "blocker" },
  { id: "C-4.1", category: "claims", title: "No comparisons", body: "Comparisons with other brands are not allowed.", severity: "blocker" },
  { id: "C-4.2", category: "claims", title: "Superlatives need evidence", body: "Superlatives like \"#1\", \"best\", \"most recommended\" or \"India's favourite\" need a current study or ranking on file. None is on file today.", severity: "blocker" },
  { id: "C-5.1", category: "claims", title: "Prices and offers must be current", body: "Prices, offers and delivery terms must match a currently valid fact.", severity: "blocker" },
  { id: "C-5.2", category: "claims", title: "Offers need an end date", body: "Offers must state the end date.", severity: "major" },
  // Visual
  { id: "VI-1", category: "visual", title: "Brand colours only", body: "Brand colours only: Forest #2E6B3F, Saffron #E8772E, Cream #F4EFE2, Ink #1D2129. Any other dominant colour needs approval.", severity: "major" },
  { id: "VI-2", category: "visual", title: "Brand fonts", body: "Headings in Playfair Display, body text in Inter.", severity: "minor" },
  { id: "VI-3", category: "visual", title: "Logo use", body: "Logo: never stretched, recoloured or rotated; clear space equal to the height of the \"A\" on all sides.", severity: "major" },
  { id: "VI-4", category: "visual", title: "Readable text on images", body: "Text on images must meet WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text.", severity: "blocker" },
  { id: "VI-5", category: "visual", title: "No unproven before/after", body: "No before/after photos unless backed by an approved fact and labelled with the timeframe.", severity: "blocker" },
  // Accessibility
  { id: "A-01", category: "accessibility", title: "Alt text for every image", body: "Every image needs alt text describing the product and any text in the image.", severity: "major" },
  { id: "A-02", category: "accessibility", title: "Descriptive links", body: "No \"click here\" or \"link in bio\" as the only description of a link in emails or web copy.", severity: "minor" },
  { id: "A-03", category: "accessibility", title: "No all-caps sentences", body: "Don't write words or sentences in ALL CAPS (screen readers spell them out).", severity: "minor" },
  { id: "A-04", category: "accessibility", title: "CamelCase hashtags", body: "Hashtags in CamelCase: #AranyaNaturals, not #aranyanaturals.", severity: "minor" },
  // Disclosure
  { id: "D-01", category: "disclosure", title: "Disclose paid posts", body: "Paid influencer or partner posts must start with \"#ad\" or \"Paid partnership\".", severity: "blocker" },
  { id: "D-02", category: "disclosure", title: "Label AI images", body: "AI-generated images showing skin or results must be labelled \"AI-generated image\".", severity: "major" },
  { id: "D-03", category: "disclosure", title: "Offer terms", body: "Offers must include \"T&C apply\" and the end date.", severity: "major" },
  // Confidential
  { id: "CF-1", category: "confidential", title: "Confidential information", body: "Confidential terms (unreleased products, unannounced deals, internal costs) must never be published or sent to an external AI.", severity: "blocker" },
];

export interface FactSeed {
  id: string;
  statement: string;
  product_id?: string;
  kind: "company" | "ingredient" | "tested" | "result" | "price" | "offer" | "delivery" | "claim";
  source: string;
  owner: string;
  valid_from?: string;
  valid_until?: string;
  status: "active" | "draft";
  suggested_copy?: string;
  duration_days?: number;
  price?: number;
  check_pattern?: string;
  check_value?: string;
  keywords?: string;
}

export const FACTS: FactSeed[] = [
  { id: "F-01", statement: "Aranya Naturals was founded in 2021 in Bengaluru.", kind: "company", source: "Company profile", owner: "Brand", status: "active", check_pattern: "founded in (\\d{4})", check_value: "2021" },
  { id: "F-02", statement: "All Aranya Naturals products are cruelty-free and not tested on animals.", kind: "claim", source: "Supplier declaration 2026", owner: "Ops", valid_until: "2027-12-31", status: "active", keywords: "cruelty-free|cruelty free|not tested on animals" },
  { id: "F-03", statement: "Neem Purifying Cleanser is made with 95% plant-derived ingredients.", product_id: "P1", kind: "ingredient", source: "Formulation sheet v2", owner: "R&D", status: "active", suggested_copy: "95% plant-derived", check_pattern: "(\\d{1,3})\\s?%\\s*plant[- ]?derived", check_value: "95" },
  { id: "F-04", statement: "Aloe Calm Gel contains 92% aloe vera juice.", product_id: "P2", kind: "ingredient", source: "Formulation sheet v1", owner: "R&D", status: "active", suggested_copy: "92% aloe vera juice", check_pattern: "(\\d{1,3})\\s?%\\s*aloe", check_value: "92" },
  { id: "F-05", statement: "Neem Purifying Cleanser is soap-free and pH balanced (pH 5.5).", product_id: "P1", kind: "ingredient", source: "Formulation sheet v2", owner: "R&D", status: "active", check_pattern: "ph\\s*(\\d(?:\\.\\d)?)", check_value: "5.5" },
  { id: "F-06", statement: "All Aranya Naturals products are free from parabens and sulphates.", kind: "ingredient", source: "Formulation sheets", owner: "R&D", status: "active", keywords: "paraben|sulphate|sulfate" },
  { id: "F-07", statement: "Neem Purifying Cleanser is dermatologically tested on 50 volunteers with Indian skin types.", product_id: "P1", kind: "tested", source: "Lab report DT-2026-04", owner: "R&D", valid_until: "2027-03-31", status: "active", suggested_copy: "dermatologically tested" },
  { id: "F-08", statement: "Turmeric Glow Serum contains 2% turmeric extract and 5% niacinamide.", product_id: "P3", kind: "ingredient", source: "Formulation sheet v3", owner: "R&D", status: "active", check_pattern: "(\\d{1,2})\\s?%\\s*turmeric", check_value: "2" },
  { id: "F-09", statement: "Sun Shield SPF 50 Gel offers SPF 50 and PA++++ protection.", product_id: "P5", kind: "claim", source: "SPF test report ST-2026-02", owner: "R&D", valid_until: "2028-02-29", status: "active", check_pattern: "spf\\s?(\\d{2})", check_value: "50" },
  { id: "F-10", statement: "Sun Shield SPF 50 Gel leaves no white cast on Indian skin tones (tested on 40 volunteers).", product_id: "P5", kind: "claim", source: "Consumer test CT-2026-07", owner: "R&D", valid_until: "2027-07-31", status: "active", keywords: "white cast" },
  { id: "F-11", statement: "Sandalwood Night Cream uses sandalwood oil sourced from Karnataka.", product_id: "P4", kind: "ingredient", source: "Supplier certificate", owner: "Ops", valid_until: "2026-12-31", status: "active" },
  { id: "F-12", statement: "Neem Purifying Cleanser visibly reduces blemishes in 4 weeks of regular use (consumer trial, n=120).", product_id: "P1", kind: "result", source: "Consumer trial CT-2026-03", owner: "R&D", valid_until: "2027-06-30", status: "active", suggested_copy: "See visibly fewer blemishes in 4 weeks of regular use (consumer trial, 120 people).", duration_days: 28 },
  { id: "F-13", statement: "Aloe Calm Gel soothes skin redness within 30 minutes of application (consumer trial, n=60).", product_id: "P2", kind: "result", source: "Consumer trial CT-2026-05", owner: "R&D", valid_until: "2027-06-30", status: "active", suggested_copy: "Soothes skin redness within 30 minutes (consumer trial, 60 people).", duration_days: 0.02 },
  { id: "F-14", statement: "Turmeric Glow Serum shows visibly more even-toned skin in 6 weeks (consumer trial, n=90).", product_id: "P3", kind: "result", source: "Consumer trial CT-2026-06", owner: "R&D", valid_until: "2027-06-30", status: "active", suggested_copy: "Visibly more even-toned skin in 6 weeks (consumer trial, 90 people).", duration_days: 42 },
  { id: "F-15", statement: "9 out of 10 users said their skin felt less oily after 2 weeks of using Neem Purifying Cleanser (n=120).", product_id: "P1", kind: "result", source: "Consumer trial CT-2026-03", owner: "R&D", valid_until: "2027-06-30", status: "active", duration_days: 14 },
  { id: "F-20", statement: "Price of Neem Purifying Cleanser 100 ml: ₹299.", product_id: "P1", kind: "price", source: "Price list Q3 2026", owner: "Sales", valid_from: "2026-07-01", valid_until: "2026-10-31", status: "active", price: 299 },
  { id: "F-21", statement: "Price of Neem Purifying Cleanser 100 ml: ₹349.", product_id: "P1", kind: "price", source: "Price list Q4 2026", owner: "Sales", valid_from: "2026-11-01", valid_until: "2027-01-31", status: "active", price: 349 },
  { id: "F-22", statement: "Price of Aloe Calm Gel 150 ml: ₹249.", product_id: "P2", kind: "price", source: "Price list Q4 2026", owner: "Sales", valid_from: "2026-11-01", valid_until: "2027-01-31", status: "active", price: 249 },
  { id: "F-23", statement: "Price of Turmeric Glow Serum 30 ml: ₹599.", product_id: "P3", kind: "price", source: "Price list Q4 2026", owner: "Sales", valid_from: "2026-11-01", valid_until: "2027-01-31", status: "active", price: 599 },
  { id: "F-24", statement: "Diwali offer: 20% off on all cleansers, ends 15 Nov 2026. T&C apply.", kind: "offer", source: "Campaign brief DW-26", owner: "Marketing", valid_until: "2026-11-15", status: "active", suggested_copy: "Ends 15 Nov 2026. T&C apply.", check_pattern: "(\\d{1,2})\\s?%\\s*off", check_value: "20" },
  { id: "F-25", statement: "Free delivery on orders above ₹499.", kind: "delivery", source: "Website T&C", owner: "Ops", status: "active", price: 499 },
  { id: "F-26", statement: "Packaging is 100% recyclable.", kind: "claim", source: "No document attached", owner: "Ops", status: "draft", keywords: "recyclable" },
];

export interface TermSeed {
  id: string;
  kind: "brand_name" | "product_name" | "banned" | "preferred";
  variants: string; // "|"-separated, longest first. A leading "=" means case-sensitive.
  replacement?: string;
  rule_id: string;
  severity: Sev;
  note?: string;
}

export const TERMS: TermSeed[] = [
  { id: "T-01", kind: "brand_name", variants: "Aranya Natural|=Aranya naturals|=ARANYA NATURALS|=ARANYA", replacement: "Aranya Naturals", rule_id: "T-01", severity: "major", note: "Always write the brand name as \"Aranya Naturals\"." },
  { id: "T-02", kind: "product_name", variants: "Neem Face Wash|Neem Facewash|Neem Facewash", replacement: "Neem Purifying Cleanser", rule_id: "T-02", severity: "major" },
  { id: "T-03", kind: "product_name", variants: "Aloe Vera Gel|Aloe Gel", replacement: "Aloe Calm Gel", rule_id: "T-03", severity: "major" },
  { id: "T-04", kind: "product_name", variants: "Turmeric Serum|Haldi Serum", replacement: "Turmeric Glow Serum", rule_id: "T-04", severity: "major" },
  { id: "T-06", kind: "product_name", variants: "Sunscreen 50|SPF Gel", replacement: "Sun Shield SPF 50 Gel", rule_id: "T-06", severity: "major" },
  { id: "T-07", kind: "banned", variants: "100% chemical-free|100% chemical free|chemical-free|chemical free|toxin-free|toxin free|100% natural", replacement: "", rule_id: "T-07", severity: "major", note: "Every product contains chemicals. Use the approved ingredient claim instead (e.g. F-03)." },
  { id: "T-08", kind: "banned", variants: "cures|cure|heals|heal|treats|miracle|magic", rule_id: "C-2.2", severity: "blocker", note: "Medical or magical claims are not allowed." },
  { id: "T-09", kind: "banned", variants: "guaranteed results|permanent results|100% safe", rule_id: "T-09", severity: "blocker", note: "Absolute promises can't be backed by evidence." },
  { id: "T-10", kind: "banned", variants: "fairness|whitening|lightening|fair skin|fairer skin", replacement: "even-toned skin", rule_id: "T-10", severity: "blocker", note: "Colourism language is banned. Use \"even-toned\" or \"glow\"." },
  { id: "T-11", kind: "banned", variants: "clinically proven", replacement: "dermatologically tested", rule_id: "T-11", severity: "blocker", note: "Only \"dermatologically tested\" is backed by a fact (F-07)." },
  { id: "T-13", kind: "preferred", variants: "problem skin|acne-ridden|ugly", replacement: "blemish-prone skin", rule_id: "V-06", severity: "major" },
  { id: "T-14", kind: "banned", variants: "repairs damaged skin|repair damaged skin|prevents acne|removes acne", rule_id: "C-2.2", severity: "blocker", note: "Medical-style claim without an approved fact." },
];

export const PALETTE = [
  { id: "forest", name: "Forest", hex: "#2E6B3F" },
  { id: "saffron", name: "Saffron", hex: "#E8772E" },
  { id: "cream", name: "Cream", hex: "#F4EFE2" },
  { id: "ink", name: "Ink", hex: "#1D2129" },
];

export const CONFIDENTIAL = [
  { id: "CT-1", phrase: "Project Kesar", note: "Unreleased saffron face oil, launch Feb 2027" },
  { id: "CT-2", phrase: "Nykaa exclusive deal", note: "Unannounced partnership" },
  { id: "CT-3", phrase: "₹189 cost price", note: "Internal cost" },
];

export interface SampleSeed {
  key: string;
  title: string;
  channel: string;
  text: string;
  image?: string;
  imageText?: string;
  imageAlt?: string;
  hint: string;
}

export const SAMPLES: SampleSeed[] = [
  { key: "S-01", title: "Neem cleanser launch post", channel: "instagram", text: "Say goodbye to acne in just 3 days! Aranya's 100% chemical-free Neem Face Wash is India's #1 dermatologist-recommended cleanser. Grab it NOW at ₹299!! 🌿🌿🌿🌿🌿", image: "/samples/creative-s01.jpg", imageText: "ACNE GONE IN 3 DAYS! The neem face wash India trusts. ONLY ₹299", imageAlt: "", hint: "Instagram post + creative with 10+ issues" },
  { key: "S-02", title: "Diwali sale email", channel: "email", text: "Subject: LAST CHANCE: Diwali sale ends soon!\n\nHi there, our Diwali offer gives you 25% off all cleansers. Click here to shop. Our Aloe Vera Gel heals sunburn overnight.", hint: "Email with wrong offer and medical claim" },
  { key: "S-03", title: "Influencer caption (Priya)", channel: "influencer", text: "Obsessed with my new Turmeric Serum from @aranyanaturals 😍 it gave me fair skin in a week! Use code PRIYA10 #glowup #aranyanaturals", hint: "Influencer post with no #ad" },
  { key: "S-04", title: "Website product description", channel: "website", text: "Neem Purifying Cleanser is a soap-free, pH-balanced cleanser made with 95% plant-derived ingredients. In a consumer trial with 120 people, it visibly reduced blemishes in 4 weeks of regular use. ₹349 for 100 ml. Free delivery on orders above ₹499.", hint: "Clean copy (should pass)" },
  { key: "S-05", title: "Press release: brand story", channel: "press", text: "Aranya Natural, India's best natural skincare brand, today announced that its products are clinically proven and 100% safe for all skin types. Founded in 2019, the brand is loved by lakhs of customers. Yaar, it's a game changer!", hint: "Press release with wrong facts" },
  { key: "S-06", title: "Teaser post", channel: "instagram", text: "Big things coming! Our team is busy with Project Kesar 🧡 Meanwhile, try our Sun Shield SPF 50 Gel with SPF 50, PA++++ and no white cast.", hint: "Leaks a confidential project" },
  { key: "S-08", title: "Night cream ad", channel: "ad", text: "Unlike other brands full of harsh chemicals, our Sandalwood Night Cream works while you sleep to repair damaged skin.", hint: "Competitor comparison" },
];
